import { z, ZodError } from 'zod'
import { TipoRegra } from '@prisma/client'
import { corrigirRegexData } from '../services/validationService'

const campoObrigatorioSchema = z.object({ campo: z.string().min(1, 'campo é obrigatório') })
const formatoSchema = z.object({
  campo: z.string().min(1, 'campo é obrigatório'),
  regex: z.string().min(1, 'regex é obrigatório'),
  formatoDescricao: z.string().trim().max(240).optional(),
})
const intervaloSchema = z.object({
  campo: z.string().min(1, 'campo é obrigatório'),
  min: z.coerce.number({ required_error: 'min é obrigatório' }),
  max: z.coerce.number({ required_error: 'max é obrigatório' }),
})
const calculoSchema = z.object({
  expressao: z.string().min(1, 'expressao é obrigatória'),
  campo_resultado: z.string().min(1, 'campo_resultado é obrigatório'),
  tolerancia: z.coerce.number().optional().default(0),
})

export const regraSugeridaSchema = z.object({
  nome: z.string().min(1),
  tipo: z.nativeEnum(TipoRegra),
  obrigatoria: z.boolean().optional().default(true),
  parametros: z.record(z.unknown()),
})

export function parseRegraParametros(
  tipo: TipoRegra,
  raw: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: ZodError } {
  if (tipo === 'campo_obrigatorio') {
    const result = campoObrigatorioSchema.safeParse(raw)
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error }
  }
  if (tipo === 'formato') {
    const result = formatoSchema.safeParse(raw)
    if (!result.success) return { success: false, error: result.error }
    return { success: true, data: { ...result.data, regex: corrigirRegexData(result.data.regex) } }
  }
  if (tipo === 'intervalo') {
    const result = intervaloSchema.safeParse(raw)
    return result.success ? { success: true, data: result.data } : { success: false, error: result.error }
  }
  const result = calculoSchema.safeParse(raw)
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error }
}

export function sanitizeRegrasSugeridas(raw: unknown) {
  const list = z.array(regraSugeridaSchema).max(20).safeParse(raw)
  if (!list.success) return []

  const regras: Array<{
    nome: string
    tipo: TipoRegra
    obrigatoria: boolean
    parametros: Record<string, unknown>
  }> = []

  for (const item of list.data) {
    const parsed = parseRegraParametros(item.tipo, item.parametros)
    if (!parsed.success) continue
    regras.push({
      nome: item.nome.trim(),
      tipo: item.tipo,
      obrigatoria: item.obrigatoria,
      parametros: parsed.data,
    })
  }

  return regras
}
