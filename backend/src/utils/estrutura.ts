import { randomUUID } from 'crypto'
import { z } from 'zod'

export const TIPOS_CAMPO = ['texto', 'numero', 'data', 'moeda', 'documento', 'texto_longo'] as const
export type TipoCampo = (typeof TIPOS_CAMPO)[number]

export const campoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  identificador: z.string().min(1).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Identificador inválido'),
  tipo: z.enum(TIPOS_CAMPO),
  obrigatorio: z.boolean().optional().default(false),
  descricao: z.string().optional().default(''),
  valorPadrao: z.string().optional().default(''),
})

export const estruturaSchema = z.object({
  secoes: z.array(z.object({
    id: z.string().min(1),
    nome: z.string().min(1),
    campos: z.array(campoSchema),
  })),
})

export type CampoEstrutura = z.infer<typeof campoSchema>
export type EstruturaTemplate = z.infer<typeof estruturaSchema>

export function emptyEstrutura(): EstruturaTemplate {
  return {
    secoes: [{ id: randomUUID(), nome: 'Identificação', campos: [] }],
  }
}

export function slugifyIdentificador(raw: string): string {
  const ascii = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!ascii) return 'campo'
  return /^[a-z]/.test(ascii) ? ascii : `campo_${ascii}`
}

function humanize(identificador: string): string {
  return identificador
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function guessTipo(identificador: string): TipoCampo {
  const id = identificador.toLowerCase()
  if (/(cnpj|cpf|ie|inscricao)/.test(id)) return 'documento'
  if (/(valor|preco|total|subtotal|desconto|imposto|aliquota|moeda)/.test(id)) return 'moeda'
  if (/(data|emissao|vencimento)/.test(id)) return 'data'
  if (/(qtd|quantidade|numero|nro|nfe)/.test(id)) return 'numero'
  if (/(obs|observ|descricao|texto)/.test(id)) return 'texto_longo'
  return 'texto'
}

export function parseEstrutura(raw: unknown): EstruturaTemplate | null {
  const parsed = estruturaSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function flattenCampos(estrutura: EstruturaTemplate | null | undefined): CampoEstrutura[] {
  if (!estrutura?.secoes) return []
  return estrutura.secoes.flatMap((secao) => secao.campos)
}

export function countCampos(estrutura: unknown): number {
  return flattenCampos(parseEstrutura(estrutura)).length
}

export function buildEstruturaFromRegras(
  regras: Array<{ tipo?: string; parametros?: unknown }>
): EstruturaTemplate {
  const obrigatorios = new Set<string>()
  const ids: string[] = []

  for (const regra of regras) {
    const params = (regra.parametros && typeof regra.parametros === 'object'
      ? regra.parametros
      : {}) as Record<string, unknown>
    const names = [params.campo, params.campo_resultado]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => slugifyIdentificador(value))

    for (const name of names) {
      if (!ids.includes(name)) ids.push(name)
    }
    if (regra.tipo === 'campo_obrigatorio' && names[0]) obrigatorios.add(names[0])
  }

  return {
    secoes: [{
      id: randomUUID(),
      nome: ids.length ? 'Campos do documento' : 'Identificação',
      campos: ids.map((identificador) => ({
        id: randomUUID(),
        nome: humanize(identificador),
        identificador,
        tipo: guessTipo(identificador),
        obrigatorio: obrigatorios.has(identificador),
        descricao: '',
        valorPadrao: '',
      })),
    }],
  }
}

export function valoresFromText(
  texto: string,
  estrutura: EstruturaTemplate | null
): Record<string, string> {
  const valores: Record<string, string> = {}
  if (!texto.trim() || !estrutura) return valores

  for (const campo of flattenCampos(estrutura)) {
    const labels = [campo.nome, campo.identificador].filter(Boolean)
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = texto.match(new RegExp(`${escaped}\\s*[:\\-–]\\s*(.+)`, 'i'))
      if (match?.[1]) {
        valores[campo.identificador] = match[1].split('\n')[0].trim()
        break
      }
    }
  }
  return valores
}
