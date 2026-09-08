import type { Documento } from '../types'

const REPROVADOS = new Set(['reprovado', 'reprovado_automatico', 'erro_extracao'])

export function analiseAprovada(documento?: Documento | null): boolean {
  if (!documento) return false
  if (documento.status === 'aprovado') return true
  if (REPROVADOS.has(documento.status)) return false
  return documento.validacoes?.some((item) => item.resultado === 'aprovado') ?? false
}

export function analiseReprovada(documento?: Documento | null): boolean {
  if (!documento) return false
  if (REPROVADOS.has(documento.status)) return true
  return documento.validacoes?.some((item) => item.resultado === 'reprovado') ?? false
}

export function analisePendente(documento?: Documento | null): boolean {
  if (!documento) return false
  return ['processando', 'aguardando_validacao'].includes(documento.status)
}
