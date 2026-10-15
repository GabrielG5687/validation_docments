import { RegraValidacao } from '@prisma/client'
import { normalizarData } from './extracao/normalizadores'

export interface ResultadoInput {
  regraId: string
  status: 'aprovado' | 'reprovado'
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
    status: ok ? 'aprovado' : 'reprovado',
    valorEncontrado: value === undefined || value === null ? undefined : String(value),
    criterio,
  }
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

export function aplicarRegra(regra: RegraValidacao, dados: Record<string, string>): ResultadoInput {
  const params = paramsOf(regra)
  if (regra.tipo === 'campo_obrigatorio') {
    const campo = String(params.campo ?? '')
    const value = dados[campo]
    return result(regra, typeof value === 'string' && value.trim().length > 0, value, 'campo presente e não vazio')
  }
  if (regra.tipo === 'formato') {
    const campo = String(params.campo ?? '')
    const value = dados[campo]
    if (typeof value !== 'string') return result(regra, false, value, `regex: ${String(params.regex ?? '')}`)
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
      return result(regra, false, value, 'expressão regular inválida')
    }
  }
  if (regra.tipo === 'intervalo') {
    const campo = String(params.campo ?? '')
    const value = dados[campo]
    const number = Number(value)
    const min = Number(params.min)
    const max = Number(params.max)
    return result(regra, Number.isFinite(number) && number >= min && number <= max, value, `intervalo inclusivo: ${min} a ${max}`)
  }
  const expression = String(params.expressao ?? '')
  const expected = Number(dados[String(params.campo_resultado ?? '')])
  const tolerance = Number(params.tolerancia ?? 0)
  try {
    const calculated = evaluateExpression(expression, dados)
    return result(regra, Number.isFinite(expected) && Math.abs(calculated - expected) <= tolerance, expected, `cálculo ${calculated}, esperado ${expected} ± ${tolerance}`)
  } catch {
    return result(regra, false, Number.isFinite(expected) ? expected : undefined, 'expressão de cálculo inválida ou valor ausente')
  }
}

export default { aplicarRegra }
