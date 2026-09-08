import { RegraValidacao } from '@prisma/client'

export interface ResultadoInput {
  regraId: string
  status: 'aprovado' | 'reprovado'
  valorEncontrado?: string
  criterio: string
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
      const regex = new RegExp(String(params.regex ?? ''))
      return result(regra, regex.test(value), value, `regex: ${regex.source}`)
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
