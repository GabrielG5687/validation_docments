import { z } from 'zod'
import { decode, encode } from '@toon-format/toon'
import { sanitizeRegrasSugeridas } from '../utils/regraParams'
import { validarRegexGerado } from '../utils/regexGerado'

const MAX_CHARS = 12_000
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const TOON_INSTRUCAO =
  'Responda APENAS em TOON, sem JSON nem texto fora do formato: um "chave: valor" por linha, indentação de 2 espaços e sem chaves; lista = cabeçalho "chave[N]:" seguido de N itens; strings vazias ou com vírgula entre aspas duplas; [N] sempre igual ao número real de itens.'

export class GroqConfigError extends Error {
  constructor(message = 'GROQ_API_KEY não configurada') {
    super(message)
    this.name = 'GroqConfigError'
  }
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim())
}

function extrairConteudo(content: string): string {
  const texto = content.trim()
  const bloco = texto.match(/```[a-zA-Z]*\s*([\s\S]*?)```/)
  if (bloco) return bloco[1].trim()
  return texto.replace(/^```(?:toon|json)?\s*/i, '').replace(/```$/u, '').trim()
}

function extrairJson(texto: string): string {
  const inicio = texto.indexOf('{')
  const fim = texto.lastIndexOf('}')
  return inicio >= 0 && fim > inicio ? texto.slice(inicio, fim + 1) : texto
}

function parseRespostaIa(content: string): unknown {
  const texto = extrairConteudo(content)
  for (const candidato of [texto, extrairJson(texto)]) {
    try {
      return JSON.parse(candidato) as unknown
    } catch {
      // tenta o próximo formato
    }
  }
  return decode(texto, { strict: false }) as unknown
}

function blocoToon(valor: unknown): string {
  const toon = encode(valor) || (Array.isArray(valor) ? '[]' : '{}')
  return ['```toon', toon, '```'].join('\n')
}

async function groqToon<T>(system: string, user: string): Promise<T> {
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
      return parseRespostaIa(content) as T
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
    } finally {
      clearTimeout(timer)
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
  const raw = await groqToon<unknown>(
    `Você gera uma expressão regular JavaScript para validar um campo documental.
${TOON_INSTRUCAO} Exemplo de resposta:
regex: fonte sem barras
exemplo: um valor que a regex aceita
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
  const raw = await groqToon<unknown>(
    `Você é um especialista em validação documental.
Gere um template de regras a partir do texto de um PDF de exemplo e da descrição orientadora, se fornecida.
${TOON_INSTRUCAO}
Cada regra tem nome, tipo (campo_obrigatorio, formato, intervalo ou calculo), obrigatoria e parametros. Exemplo de resposta:
nome: nome do template
descricao: descrição do template
regras[1]:
  - nome: nome da regra
    tipo: campo_obrigatorio
    obrigatoria: true
    parametros:
      campo: Nome do campo
Regras de parametros:
- campo_obrigatorio: parametros.campo = nome do campo como aparece no documento
- formato: parametros.campo e parametros.regex (expressão regular)
- Data brasileira: use exatamente ^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/\\d{4}$
- Nunca escreva dd, mm ou aaaa como texto dentro da regex.
- Campo de assinatura digital (orientador, responsável, signatário) deve ser campo_obrigatorio. O valor vem do certificado, não de uma linha do texto. Em parametros.assinatura use criptografica (aceita o certificado), visual (exige linha no texto) ou qualquer (padrão).
- intervalo: parametros.campo, parametros.min (número) e parametros.max (número)
- calculo: parametros.expressao ("A+B"), parametros.campo_resultado e parametros.tolerancia (número)
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
})

export async function extrairEAnalisarDocumento(
  texto: string,
  campos: string[],
  regras: Array<{ nome: string; tipo: string; parametros: unknown }>,
  rotulos?: Record<string, string>,
  descricaoTemplate?: string
) {
  const raw = await groqToon<unknown>(
    `Você extrai campos de um documento PDF.
${TOON_INSTRUCAO} Exemplo de resposta:
campos:
  codigo_verificacao: 6065c033f2
  data_emissao: ""
resumo: Código identificado.
Use exatamente as chaves pedidas (identificadores), não os rótulos.
Use a descrição do template como contexto para interpretar a finalidade e os rótulos dos campos, não como evidência do conteúdo do PDF.
Extraia os campos que estiverem presentes mesmo quando o documento não atender a uma ou mais regras. Para campos ausentes, use "".
Não invente CPF, datas ou valores numéricos críticos.`,
    `${descricaoTemplate ? `Descrição do template: ${descricaoTemplate}\n\n` : ''}Campos (chaves) em TOON:
${blocoToon(campos)}
Rótulos em TOON:
${blocoToon(rotulos || {})}
Regras em TOON:
${blocoToon(regras)}

Texto do documento:
${texto}`
  )

  const parsed = extracaoIaSchema.safeParse(raw)
  if (!parsed.success) {
    return { campos: {} as Record<string, string>, resumo: '' }
  }

  const camposNormalizados: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed.data.campos)) {
    const text = String(value).trim()
    if (text) camposNormalizados[key] = text
  }

  return {
    campos: camposNormalizados,
    resumo: parsed.data.resumo.trim(),
  }
}

const analiseTemplateSchema = z.object({
  resumo: z.string().optional().default(''),
  alertas: z.array(z.string()).optional().default([]),
  regras: z.array(z.unknown()).optional().default([]),
})

const campoOpcional = z.string().nullish().transform((valor) => valor ?? undefined)

const sugestaoTemplateSchema = z.object({
  tipoDocumento: z.string(),
  confianca: z.number().min(0).max(1),
  templateExistenteId: campoOpcional,
  templateExistenteNome: campoOpcional,
  razao: z.string(),
  sugerirNovoTemplate: z.boolean(),
  nomeSugerido: campoOpcional,
  descricaoSugerida: campoOpcional,
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

  const templatesParaIa = templatesExistentes.map(t => ({
    id: t.id,
    nome: t.nome,
    categoria: t.categoria || '',
    descricao: t.descricao || '',
  }))

  try {
    const raw = await groqToon<unknown>(
      `Você classifica um documento PDF e sugere qual template de validação usar.
${TOON_INSTRUCAO} Exemplo de resposta:
tipoDocumento: Laudo Técnico
confianca: 0.45
templateExistenteId: null
templateExistenteNome: null
razao: Sem template compatível entre os existentes.
sugerirNovoTemplate: true
nomeSugerido: Laudo Técnico
descricaoSugerida: Validação de laudo técnico com perícia e assinatura
Regras:
- Se houver template existente com confiança > 0.8, use-o (sugerirNovoTemplate: false)
- Se não houver match claro, sugira novo template (sugerirNovoTemplate: true)
- Confiança entre 0 e 1
- Use null nos campos de template quando sugerirNovoTemplate for true`,
      `Templates existentes em TOON:
${templatesParaIa.length ? blocoToon(templatesParaIa) : '(nenhum)'}

Texto do documento (início):
${texto.slice(0, 3000)}`
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
    const raw = await groqToon<unknown>(
      `Você explica em português claro por que uma regra de validação documental falhou.
${TOON_INSTRUCAO} Exemplo de resposta:
explicacao: O CPF informado (123.456.789-00) tem dígito verificador inválido.
Máximo 160 caracteres. Sem jargão técnico.`,
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
  const raw = await groqToon<unknown>(
    `Você analisa um template de validação documental e sugere melhorias.
${TOON_INSTRUCAO}
Cada regra tem nome, tipo (campo_obrigatorio, formato, intervalo ou calculo), obrigatoria e parametros. Exemplo de resposta:
resumo: Regras cobrem identificação, mas não validam valores.
alertas[2]:
  - Falta regra de intervalo para valor total
  - Regex de data não trata valor vazio
regras[1]:
  - nome: Valor total
    tipo: intervalo
    obrigatoria: true
    parametros:
      campo: Valor total
      min: 0
      max: 999999
Só sugira regras NOVAS, que ainda não existam. Use a descrição como contexto sobre a finalidade e os requisitos do template.
Se o texto do documento vier, compare-o com a descrição e as regras atuais para identificar campos ou requisitos relevantes que ainda não estejam cobertos.
Um documento de exemplo pode não cumprir todos os requisitos; isso não impede a análise nem significa que a extração falhou.`,
    `Descrição do template: ${descricaoTemplate || '(não informada)'}

Regras atuais em TOON:
${blocoToon(regrasAtuais)}

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

const parecerIaSchema = z.object({
  analise: z.string().optional().default(''),
  pendencias: z.array(z.string()).optional().default([]),
  conclusao: z.string().optional().default(''),
})

export interface ParecerIa {
  analise: string
  pendencias: string[]
  conclusao: string
}

export interface ParecerIaEntrada {
  documentoNome: string
  templateNome?: string
  resultados: Array<{
    nome: string
    tipo: string
    status: string
    valorEncontrado?: string
    criterio: string
    obrigatoria: boolean
  }>
  pendencias: Array<{ chave: string; rotulo?: string; status: string }>
}

export async function gerarParecerIa(entrada: ParecerIaEntrada): Promise<ParecerIa | null> {
  if (!isGroqConfigured() || entrada.resultados.length === 0) return null

  const comprovadas = entrada.resultados.filter(
    (item) => item.status === 'aprovado' || item.status === 'nao_conforme'
  )

  try {
    const raw = await groqToon<unknown>(
      `Você redige um parecer técnico resumido sobre a validação automática de um documento.
${TOON_INSTRUCAO} Exemplo de resposta:
analise: Os campos obrigatórios estão presentes e o CPF confere.
pendencias[1]:
  - Assinatura do orientador sem evidência verificável no texto
conclusao: Aprovado automaticamente, sem pendências.
Regras de redação:
- Use SOMENTE os dados fornecidos abaixo. Não invente valores, páginas ou fatos.
- Não afirme que o documento foi reprovado; a decisão final é humana.
- "analise" descreve o que foi comprovado, citando o valor quando houver.
- "pendencias" lista apenas itens que impedem a conclusão (não encontrado, conflito ou sem evidência).
- "conclusao" diz se pode ser aprovado automaticamente ou se depende de revisão humana.
- Português claro, objetivo, sem jargão técnico.`,
      `Documento: ${entrada.documentoNome}
${entrada.templateNome ? `Template: ${entrada.templateNome}\n` : ''}
Resultados comprovados das regras em TOON:
${comprovadas.length
  ? blocoToon(comprovadas.map((item) => ({
      regra: item.nome,
      tipo: item.tipo,
      status: item.status,
      valor: item.valorEncontrado || '',
      criterio: item.criterio,
      obrigatoria: item.obrigatoria,
    })))
  : '(nenhum)'}

Campos inconclusivos em TOON:
${entrada.pendencias.length
  ? blocoToon(entrada.pendencias.map((item) => ({ campo: item.rotulo || item.chave, status: item.status })))
  : '(nenhum)'}`
    )

    const parsed = parecerIaSchema.safeParse(raw)
    if (!parsed.success) return null
    return {
      analise: parsed.data.analise.trim(),
      pendencias: parsed.data.pendencias.map((item) => item.trim()).filter(Boolean),
      conclusao: parsed.data.conclusao.trim(),
    }
  } catch {
    return null
  }
}
