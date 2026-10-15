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

export async function gerarTemplateComIa(texto: string, nomeSugerido?: string, descricaoOrientadora?: string) {
  const raw = await groqJson<unknown>(
    `Você é um especialista em validação documental.
Gere um template de regras a partir do texto de um PDF de exemplo e da descrição orientadora, se fornecida.
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
Use nomes de campo iguais aos rótulos do documento. No máximo 12 regras. Prefira campo_obrigatorio e formato.
Use a descrição para entender a finalidade do template e definir quais requisitos devem ser verificados, mesmo quando o PDF de exemplo não os cumprir.
Use o PDF como fonte de exemplos de campos e estrutura, não como prova de que todos os requisitos estão atendidos.
Não crie regras que não possam ser verificadas no documento ou nos dados nele presentes.`,
    `Nome sugerido pelo usuário: ${nomeSugerido?.trim() || '(nenhum)'}
Descrição orientadora fornecida pelo usuário: ${descricaoOrientadora?.trim() || '(nenhuma)'}

Texto do documento de exemplo:
${texto}`
  )

  const parsed = templateIaSchema.safeParse(raw)
  if (!parsed.success) throw new Error('A IA não retornou um template válido')

  const regras = sanitizeRegrasSugeridas(parsed.data.regras)
  if (regras.length === 0) throw new Error('A IA não gerou regras válidas para este documento')

  return {
    nome: nomeSugerido?.trim() || parsed.data.nome.trim(),
    descricao: descricaoOrientadora?.trim() || parsed.data.descricao.trim(),
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
  rotulos?: Record<string, string>,
  descricaoTemplate?: string
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
Use a descrição do template como contexto para interpretar a finalidade e os rótulos dos campos, não como evidência do conteúdo do PDF.
Extraia os campos que estiverem presentes mesmo quando o documento não atender a uma ou mais regras. Para campos ausentes, use "".
Não invente CPF, datas ou valores numéricos críticos.`,
    `${descricaoTemplate ? `Descrição do template: ${descricaoTemplate}\n\n` : ''}Campos (chaves): ${JSON.stringify(campos)}\nRótulos: ${JSON.stringify(rotulos || {})}\nRegras: ${JSON.stringify(regras)}\n\nTexto do documento:\n${texto}`
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

const sugestaoTemplateSchema = z.object({
  tipoDocumento: z.string(),
  confianca: z.number().min(0).max(1),
  templateExistenteId: z.string().optional(),
  templateExistenteNome: z.string().optional(),
  razao: z.string(),
  sugerirNovoTemplate: z.boolean(),
  nomeSugerido: z.string().optional(),
  descricaoSugerida: z.string().optional(),
})

export async function sugerirTemplateParaDocumento(
  texto: string,
  templatesExistentes: Array<{ id: string; nome: string; categoria?: string; descricao?: string }>
): Promise<{
  tipoDocumento: string
  confianca: number
  templateExistenteId?: string
  templateExistenteNome?: string
  razao: string
  sugerirNovoTemplate: boolean
  nomeSugerido?: string
  descricaoSugerida?: string
}> {
  if (!isGroqConfigured()) {
    return {
      tipoDocumento: 'Desconhecido',
      confianca: 0,
      razao: 'IA não configurada',
      sugerirNovoTemplate: true,
    }
  }

  const templatesInfo = templatesExistentes.map(t => 
    `- ${t.id}: ${t.nome}${t.categoria ? ` (${t.categoria})` : ''}${t.descricao ? ` - ${t.descricao}` : ''}`
  ).join('\n')

  try {
    const raw = await groqJson<unknown>(
      `Você classifica um documento PDF e sugere qual template de validação usar.
Responda APENAS JSON:
{
  "tipoDocumento": "nome do tipo detectado (ex: Nota Fiscal, Contrato, Laudo, Plano de Curso)",
  "confianca": 0.95,
  "templateExistenteId": "uuid do template existente ou null",
  "templateExistenteNome": "nome do template existente ou null",
  "razao": "explicação curta da classificação",
  "sugerirNovoTemplate": false,
  "nomeSugerido": "nome para novo template se sugerirNovoTemplate for true",
  "descricaoSugerida": "descrição para novo template"
}
Regras:
- Se houver template existente com confiança > 0.8, use-o (sugerirNovoTemplate: false)
- Se não houver match claro, sugira novo template (sugerirNovoTemplate: true)
- Confiança entre 0 e 1`,
      `Templates existentes:\n${templatesInfo || '(nenhum)'}\n\nTexto do documento (início):\n${texto.slice(0, 3000)}`
    )
    const parsed = sugestaoTemplateSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Resposta inválida da IA')
    return parsed.data
  } catch (error) {
    return {
      tipoDocumento: 'Erro na classificação',
      confianca: 0,
      razao: error instanceof Error ? error.message : 'Falha desconhecida',
      sugerirNovoTemplate: true,
    }
  }
}

const explicacaoFalhaSchema = z.object({
  explicacao: z.string().min(1),
})

export async function explicarFalhaRegra(
  regraNome: string,
  regraTipo: string,
  criterio: string,
  valorEncontrado: string
): Promise<string> {
  if (!isGroqConfigured()) return ''
  try {
    const raw = await groqJson<unknown>(
      `Você explica em português claro por que uma regra de validação documental falhou.
Responda APENAS JSON: { "explicacao": "frase curta e direta" }
Máximo 160 caracteres. Sem jargão técnico. Exemplo: "O CPF informado (123.456.789-00) tem dígito verificador inválido."`,
      `Regra: ${regraNome} (${regraTipo})
Critério avaliado: ${criterio}
Valor encontrado no documento: ${valorEncontrado || '(vazio)'}`
    )
    const parsed = explicacaoFalhaSchema.safeParse(raw)
    return parsed.success ? parsed.data.explicacao : ''
  } catch {
    return ''
  }
}

export async function analisarTemplateComIa(
  regrasAtuais: unknown,
  textoDocumento?: string,
  descricaoTemplate?: string
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
Só sugira regras NOVAS, que ainda não existam. Use a descrição como contexto sobre a finalidade e os requisitos do template.
Se o texto do documento vier, compare-o com a descrição e as regras atuais para identificar campos ou requisitos relevantes que ainda não estejam cobertos.
Um documento de exemplo pode não cumprir todos os requisitos; isso não impede a análise nem significa que a extração falhou.`,
    `Descrição do template: ${descricaoTemplate || '(não informada)'}

Regras atuais: ${JSON.stringify(regrasAtuais)}

Texto do documento (opcional):
${textoDocumento || '(não enviado)'}`
  )

  const parsed = analiseTemplateSchema.safeParse(raw)
  if (!parsed.success) throw new Error('A IA não retornou uma análise válida')

  return {
    resumo: parsed.data.resumo.trim(),
    alertas: parsed.data.alertas.map((item) => item.trim()).filter(Boolean),
    regrasSugeridas: sanitizeRegrasSugeridas(parsed.data.regras),
  }
}
