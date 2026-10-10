import { z } from 'zod'
import { sanitizeRegrasSugeridas } from '../utils/regraParams'
import { validarRegexGerado } from '../utils/regexGerado'

const MAX_CHARS = 12_000
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export class GroqConfigError extends Error {
  constructor(message = 'GROQ_API_KEY não configurada') {
    super(message)
    this.name = 'GroqConfigError'
  }
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim())
}

function stripFences(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/u, '').trim()
}

async function groqJson<T>(system: string, user: string): Promise<T> {
  const key = process.env.GROQ_API_KEY?.trim()
  if (!key) throw new GroqConfigError()

  const preferred = process.env.GROQ_MODEL?.trim()
  const models = [...new Set([
    preferred,
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'llama-3.1-8b-instant',
  ].filter(Boolean) as string[])]

  let lastError = 'Falha ao consultar a Groq'
  for (const model of models) {
    for (const useJsonMode of [true, false]) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 45_000)
      try {
        const body: Record<string, unknown> = {
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user.slice(0, MAX_CHARS) },
          ],
        }
        if (useJsonMode) body.response_format = { type: 'json_object' }

        const response = await fetch(GROQ_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        const raw = await response.text()
        if (!response.ok) {
          lastError = `Falha na Groq (${response.status}): ${raw.slice(0, 280)}`
          continue
        }

        const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> }
        const content = data.choices?.[0]?.message?.content
        if (!content) {
          lastError = 'Resposta vazia da Groq'
          continue
        }
        return JSON.parse(stripFences(content)) as T
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError
      } finally {
        clearTimeout(timer)
      }
    }
  }

  throw new Error(lastError)
}

const regexIaSchema = z.object({
  regex: z.string().min(1),
  exemplo: z.string().optional().default(''),
})

export async function gerarRegexComIa(descricao: string) {
  const texto = descricao.trim()
  if (texto.length < 3) throw new Error('Descreva o formato que deve ser aceito.')
  const raw = await groqJson<unknown>(
    `Você gera uma expressão regular JavaScript para validar um campo documental.
Responda APENAS JSON: { "regex": "fonte sem barras", "exemplo": "um valor que a regex aceita" }
Regras:
- A regex valida o valor inteiro. Use ^ e $.
- Não use lookbehind. Evite quantificadores aninhados.
- Contexto brasileiro quando a descrição for de documento, data, placa ou telefone.
- A fonte tem no máximo 160 caracteres.`,
    `Formato desejado:\n${texto.slice(0, 240)}`,
  )
  const parsed = regexIaSchema.safeParse(raw)
  if (!parsed.success) throw new Error('A IA não retornou uma expressão válida')
  const regex = validarRegexGerado(parsed.data.regex)
  const exemplo = parsed.data.exemplo.trim()
  if (exemplo && !new RegExp(regex).test(exemplo)) {
    throw new Error('A expressão gerada não confere com o exemplo. Tente descrever o formato de outro jeito.')
  }
  return { regex, exemplo, descricao: texto }
}

const templateIaSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional().default(''),
  regras: z.array(z.unknown()).min(1),
})

export async function gerarTemplateComIa(texto: string, nomeSugerido?: string) {
  const raw = await groqJson<unknown>(
    `Você é um especialista em validação documental.
Gere um template de regras a partir do texto de um PDF de exemplo.
Responda APENAS um JSON com:
{
  "nome": "string",
  "descricao": "string",
  "regras": [
    {
      "nome": "string",
      "tipo": "campo_obrigatorio" | "formato" | "intervalo" | "calculo",
      "obrigatoria": true,
      "parametros": {}
    }
  ]
}
Regras de parametros:
- campo_obrigatorio: { "campo": "Nome do campo como aparece no documento" }
- formato: { "campo": "...", "regex": "expressão regular" }
- Data brasileira: use exatamente ^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/\\d{4}$
- Nunca escreva dd, mm ou aaaa como texto dentro da regex.
- Campo de assinatura digital (orientador, responsável, signatário) deve ser campo_obrigatorio. O valor vem do certificado, não de uma linha do texto.
- intervalo: { "campo": "...", "min": number, "max": number }
- calculo: { "expressao": "A+B", "campo_resultado": "...", "tolerancia": 0 }
Use nomes de campo iguais aos rótulos do documento. No máximo 12 regras. Prefira campo_obrigatorio e formato.`,
    `Nome sugerido pelo usuário: ${nomeSugerido || '(nenhum)'}\n\nTexto do documento:\n${texto}`
  )

  const parsed = templateIaSchema.safeParse(raw)
  if (!parsed.success) throw new Error('A IA não retornou um template válido')

  const regras = sanitizeRegrasSugeridas(parsed.data.regras)
  if (regras.length === 0) throw new Error('A IA não gerou regras válidas para este documento')

  return {
    nome: nomeSugerido?.trim() || parsed.data.nome.trim(),
    descricao: parsed.data.descricao.trim(),
    regras,
  }
}

const extracaoIaSchema = z.object({
  campos: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
  resumo: z.string().optional().default(''),
  alertas: z.array(z.string()).optional().default([]),
})

export async function extrairEAnalisarDocumento(
  texto: string,
  campos: string[],
  regras: Array<{ nome: string; tipo: string; parametros: unknown }>,
  rotulos?: Record<string, string>
) {
  const raw = await groqJson<unknown>(
    `Você extrai campos e analisa um documento contra regras de um template.
Responda APENAS JSON:
{
  "campos": { "chave_do_campo": "valor encontrado ou string vazia" },
  "resumo": "síntese curta da conformidade",
  "alertas": ["pontos de atenção"]
}
Use exatamente as chaves pedidas (identificadores), não os rótulos.
Preencha todos os campos. Se não encontrar, use "". Não invente CPF, datas ou valores numéricos críticos.`,
    `Campos (chaves): ${JSON.stringify(campos)}\nRótulos: ${JSON.stringify(rotulos || {})}\nRegras: ${JSON.stringify(regras)}\n\nTexto:\n${texto}`
  )

  const parsed = extracaoIaSchema.safeParse(raw)
  if (!parsed.success) {
    return { campos: {} as Record<string, string>, resumo: '', alertas: [] as string[] }
  }

  const camposNormalizados: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed.data.campos)) {
    const text = String(value).trim()
    if (text) camposNormalizados[key] = text
  }

  return {
    campos: camposNormalizados,
    resumo: parsed.data.resumo.trim(),
    alertas: parsed.data.alertas.map((item) => item.trim()).filter(Boolean),
  }
}

const analiseTemplateSchema = z.object({
  resumo: z.string().optional().default(''),
  alertas: z.array(z.string()).optional().default([]),
  regras: z.array(z.unknown()).optional().default([]),
})

export async function analisarTemplateComIa(
  regrasAtuais: unknown,
  textoDocumento?: string
) {
  const raw = await groqJson<unknown>(
    `Você analisa um template de validação documental e sugere melhorias.
Responda APENAS JSON:
{
  "resumo": "avaliação das regras atuais",
  "alertas": ["lacunas, regex frágeis, campos faltando"],
  "regras": [
    {
      "nome": "string",
      "tipo": "campo_obrigatorio" | "formato" | "intervalo" | "calculo",
      "obrigatoria": true,
      "parametros": {}
    }
  ]
}
Só sugira regras NOVAS, que ainda não existam. Se o texto do documento vier, use-o para achar campos faltantes.`,
    `Regras atuais: ${JSON.stringify(regrasAtuais)}\n\nTexto do documento (opcional):\n${textoDocumento || '(não enviado)'}`
  )

  const parsed = analiseTemplateSchema.safeParse(raw)
  if (!parsed.success) throw new Error('A IA não retornou uma análise válida')

  return {
    resumo: parsed.data.resumo.trim(),
    alertas: parsed.data.alertas.map((item) => item.trim()).filter(Boolean),
    regrasSugeridas: sanitizeRegrasSugeridas(parsed.data.regras),
  }
}
