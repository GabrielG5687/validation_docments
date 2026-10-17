import { RegraValidacao } from '@prisma/client'
import { normalizarData } from './extracao/normalizadores'

export type StatusRegra =
  | 'aprovado'
  | 'nao_conforme'
  | 'nao_encontrado'
  | 'extracao_conflitante'
  | 'nao_verificavel'

export interface FonteCampo {
  status: 'validado' | 'ambiguo' | 'sem_evidencia' | 'conflito' | 'corrigido_humano'
  temValor: boolean
}

export interface ResultadoInput {
  regraId: string
  status: StatusRegra
  valorEncontrado?: string
  criterio: string
  explicacaoIa?: string
}

type Params = Record<string, unknown>

function paramsOf(regra: RegraValidacao): Params {
  return (regra.parametros && typeof regra.parametros === 'object'
    ? regra.parametros
    : {}) as Params
}

function result(regra: RegraValidacao, ok: boolean, value: unknown, criterio: string): ResultadoInput {
  return {
    regraId: regra.id,
    status: ok ? 'aprovado' : 'nao_conforme',
    valorEncontrado: value === undefined || value === null ? undefined : String(value),
    criterio,
  }
}

/** Campos usados por uma regra: o campo principal ou, no cálculo, as referências da expressão e o resultado. */
function camposRelevantes(regra: RegraValidacao, params: Params): string[] {
  if (regra.tipo === 'calculo') {
    const identificadores = String(params.expressao ?? '').match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
    const resultado = typeof params.campo_resultado === 'string' ? [params.campo_resultado] : []
    return [...new Set([...resultado, ...identificadores])]
  }
  return typeof params.campo === 'string' ? [params.campo] : []
}

function temValorConfirmado(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** Distingue ausência real de extração ambígua, conflitante ou sem evidência. */
function classificarPendencia(campos: string[], fontes: Record<string, FonteCampo>): StatusRegra {
  const relevantes = campos
    .map((campo) => fontes[campo])
    .filter((fonte): fonte is FonteCampo => Boolean(fonte))
  if (relevantes.some((fonte) => fonte.status === 'conflito')) return 'extracao_conflitante'
  if (relevantes.some((fonte) => fonte.status === 'ambiguo' || (fonte.status === 'sem_evidencia' && fonte.temValor))) {
    return 'nao_verificavel'
  }
  return 'nao_encontrado'
}

function criterioPendencia(status: StatusRegra, campos: string[]): string {
  const lista = campos.join(', ')
  if (status === 'extracao_conflitante') return `leitura em conflito para: ${lista}`
  if (status === 'nao_verificavel') return `valor sem evidência verificável para: ${lista}`
  return `campo não encontrado: ${lista}`
}

/**
 * Evaluates a deliberately small arithmetic language. Identifiers can only
 * resolve to numeric extracted fields; no JavaScript globals or properties are
 * reachable from the expression.
 */
function evaluateExpression(expression: string, data: Record<string, string>): number {
  const tokens = expression.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[()+\-*/]/g)
  if (!tokens || tokens.join('') !== expression.replace(/\s+/g, '')) throw new Error('Expressão inválida')
  let index = 0
  const peek = () => tokens[index]
  const consume = () => tokens[index++]
  const primary = (): number => {
    const token = consume()
    if (token === '(') {
      const value = addSub()
      if (consume() !== ')') throw new Error('Expressão inválida')
      return value
    }
    if (token === '+' || token === '-') {
      const value = primary()
      return token === '-' ? -value : value
    }
    const raw = token && /^[A-Za-z_]/.test(token) ? data[token] : token
    const value = Number(raw)
    if (!Number.isFinite(value)) throw new Error('Valor numérico ausente')
    return value
  }
  const mulDiv = (): number => {
    let value = primary()
    while (peek() === '*' || peek() === '/') {
      const op = consume()
      const right = primary()
      if (op === '/' && right === 0) throw new Error('Divisão por zero')
      value = op === '*' ? value * right : value / right
    }
    return value
  }
  const addSub = (): number => {
    let value = mulDiv()
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const right = mulDiv()
      value = op === '+' ? value + right : value - right
    }
    return value
  }
  const value = addSub()
  if (index !== tokens.length || !Number.isFinite(value)) throw new Error('Expressão inválida')
  return value
}

function prepararTexto(value: string): string {
  return value
    .replace(/[\u2215\u2044\uFF0F]/g, '/')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u00A0\u202F]/g, ' ')
    .trim()
}

/** Corrige regex de data em que a IA gravou dd, mm ou aaaa como texto literal. */
export function corrigirRegexData(fonte: string): string {
  return fonte
    .replace(/\bdd\b/g, '(0[1-9]|[12][0-9]|3[01])')
    .replace(/\bmm\b/g, '(0[1-9]|1[0-2])')
    .replace(/\b(aaaa|yyyy)\b/gi, '\\d{4}')
}

function candidatosDeFormato(value: string): string[] {
  const base = prepararTexto(value)
  const candidatos = [base]
  const data = base.match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/)
  if (data) candidatos.push(`${data[1].padStart(2, '0')}/${data[2].padStart(2, '0')}/${data[3]}`)
  return [...new Set(candidatos)]
}

function pareceData(fonte: string): boolean {
  const texto = fonte.toLowerCase()
  if (!texto.includes('/')) return false
  if (/\bdd\b|\bmm\b|aaaa|yyyy/.test(texto)) return true
  return /\\d\{2\}/.test(fonte) && /\\d\{4\}/.test(fonte)
}

export function aplicarRegra(
  regra: RegraValidacao,
  dados: Record<string, string>,
  fontes: Record<string, FonteCampo> = {},
): ResultadoInput {
  const params = paramsOf(regra)
  const campos = camposRelevantes(regra, params)
  if (campos.length === 0) {
    return { regraId: regra.id, status: 'nao_verificavel', criterio: 'regra sem campo configurado' }
  }
  const faltando = campos.filter((campo) => !temValorConfirmado(dados[campo]))
  if (faltando.length > 0) {
    const status = classificarPendencia(faltando, fontes)
    return { regraId: regra.id, status, criterio: criterioPendencia(status, faltando) }
  }

  if (regra.tipo === 'campo_obrigatorio') {
    const campo = String(params.campo ?? '')
    return result(regra, true, dados[campo], 'campo presente e não vazio')
  }
  if (regra.tipo === 'formato') {
    const campo = String(params.campo ?? '')
    const value = dados[campo]
    try {
      const fonte = corrigirRegexData(String(params.regex ?? ''))
      const regex = new RegExp(fonte)
      const candidatos = candidatosDeFormato(value)
      const aceito = candidatos.find((item) => regex.test(item))
      if (aceito) return result(regra, true, aceito, `regex: ${regex.source}`)
      if (pareceData(fonte)) {
        const data = normalizarData(candidatos[candidatos.length - 1])
        if (data.ok) return result(regra, true, data.canonico, `data brasileira: ${data.canonico}`)
      }
      return result(regra, false, value, `regex: ${regex.source}`)
    } catch {
      return { regraId: regra.id, status: 'nao_verificavel', valorEncontrado: value, criterio: 'expressão regular inválida' }
    }
  }
  if (regra.tipo === 'intervalo') {
    const campo = String(params.campo ?? '')
    const value = dados[campo]
    const number = Number(value)
    const min = Number(params.min)
    const max = Number(params.max)
    if (!Number.isFinite(number)) {
      return { regraId: regra.id, status: 'nao_verificavel', valorEncontrado: value, criterio: `valor não numérico para intervalo: ${min} a ${max}` }
    }
    return result(regra, number >= min && number <= max, value, `intervalo inclusivo: ${min} a ${max}`)
  }
  const expression = String(params.expressao ?? '')
  const expected = Number(dados[String(params.campo_resultado ?? '')])
  const tolerance = Number(params.tolerancia ?? 0)
  try {
    const calculated = evaluateExpression(expression, dados)
    return result(regra, Number.isFinite(expected) && Math.abs(calculated - expected) <= tolerance, expected, `cálculo ${calculated}, esperado ${expected} ± ${tolerance}`)
  } catch {
    return {
      regraId: regra.id,
      status: 'nao_verificavel',
      valorEncontrado: Number.isFinite(expected) ? String(expected) : undefined,
      criterio: 'expressão de cálculo inválida',
    }
  }
}

export default { aplicarRegra }
