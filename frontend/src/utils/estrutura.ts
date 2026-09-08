import type { CampoTemplate, EstruturaTemplate, RegraValidacao, SecaoTemplate, TipoCampo } from '../types'

export const TIPOS_CAMPO: Array<{ value: TipoCampo; label: string }> = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'data', label: 'Data' },
  { value: 'moeda', label: 'Moeda' },
  { value: 'documento', label: 'Documento' },
  { value: 'texto_longo', label: 'Texto longo' },
]

export function newId() {
  return crypto.randomUUID()
}

export function emptyEstrutura(): EstruturaTemplate {
  return { secoes: [{ id: newId(), nome: 'Identificação', campos: [] }] }
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

export function isIdentificadorValido(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
}

export function parseEstrutura(raw: unknown): EstruturaTemplate | null {
  if (!raw || typeof raw !== 'object' || !('secoes' in raw)) return null
  const secoes = (raw as EstruturaTemplate).secoes
  if (!Array.isArray(secoes)) return null
  return {
    secoes: secoes.map((secao) => ({
      id: secao.id || newId(),
      nome: secao.nome || 'Seção',
      campos: Array.isArray(secao.campos)
        ? secao.campos.map((campo) => ({
            id: campo.id || newId(),
            nome: campo.nome || 'Campo',
            identificador: slugifyIdentificador(campo.identificador || campo.nome || 'campo'),
            tipo: campo.tipo || 'texto',
            obrigatorio: Boolean(campo.obrigatorio),
            descricao: campo.descricao || '',
            valorPadrao: campo.valorPadrao || '',
          }))
        : [],
    })),
  }
}

export function flattenCampos(estrutura?: EstruturaTemplate | null): CampoTemplate[] {
  return estrutura?.secoes.flatMap((secao) => secao.campos) ?? []
}

export function countCampos(estrutura?: EstruturaTemplate | null): number {
  return flattenCampos(estrutura).length
}

export function countSecoes(estrutura?: EstruturaTemplate | null): number {
  return estrutura?.secoes.length ?? 0
}

function humanize(identificador: string): string {
  return identificador.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\w/, (c) => c.toUpperCase())
}

function guessTipo(identificador: string): TipoCampo {
  const id = identificador.toLowerCase()
  if (/(cnpj|cpf|ie|inscricao)/.test(id)) return 'documento'
  if (/(valor|preco|total|subtotal|desconto|imposto|aliquota|moeda)/.test(id)) return 'moeda'
  if (/(data|emissao|vencimento)/.test(id)) return 'data'
  if (/(qtd|quantidade|numero|nro)/.test(id)) return 'numero'
  if (/(obs|observ|descricao|texto)/.test(id)) return 'texto_longo'
  return 'texto'
}

export function estruturaFromRegras(regras: RegraValidacao[]): EstruturaTemplate {
  const obrigatorios = new Set<string>()
  const ids: string[] = []
  for (const regra of regras) {
    const names = [regra.parametros?.campo, regra.parametros?.campo_resultado]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => slugifyIdentificador(value))
    for (const name of names) if (!ids.includes(name)) ids.push(name)
    if (regra.tipo === 'campo_obrigatorio' && names[0]) obrigatorios.add(names[0])
  }
  return {
    secoes: [{
      id: newId(),
      nome: ids.length ? 'Campos do documento' : 'Identificação',
      campos: ids.map((identificador) => ({
        id: newId(),
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

export function uniqueIdentificador(estrutura: EstruturaTemplate, base: string, exceptId?: string): string {
  const used = new Set(
    flattenCampos(estrutura)
      .filter((campo) => campo.id !== exceptId)
      .map((campo) => campo.identificador)
  )
  let candidate = slugifyIdentificador(base)
  let i = 2
  while (used.has(candidate)) {
    candidate = `${slugifyIdentificador(base)}_${i}`
    i += 1
  }
  return candidate
}

export function cloneEstrutura(estrutura: EstruturaTemplate): EstruturaTemplate {
  return JSON.parse(JSON.stringify(estrutura)) as EstruturaTemplate
}

export function findCampo(estrutura: EstruturaTemplate, campoId: string): { secao: SecaoTemplate; campo: CampoTemplate } | null {
  for (const secao of estrutura.secoes) {
    const campo = secao.campos.find((item) => item.id === campoId)
    if (campo) return { secao, campo }
  }
  return null
}

export function inputTypeFor(tipo: TipoCampo): string {
  if (tipo === 'numero' || tipo === 'moeda') return 'number'
  if (tipo === 'data') return 'date'
  return 'text'
}

export function placeholderFor(campo: CampoTemplate): string {
  if (campo.valorPadrao) return campo.valorPadrao
  return `{{${campo.identificador}}}`
}
