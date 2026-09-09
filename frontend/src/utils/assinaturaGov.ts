import type { ValidacaoAssinaturaGov } from '../types'

export function assinaturaGovFromDados(dados?: Record<string, unknown>): ValidacaoAssinaturaGov | undefined {
  const raw = dados?._assinaturaGov
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<ValidacaoAssinaturaGov>
  if (!value.status || !Array.isArray(value.assinaturas)) return undefined
  return value as ValidacaoAssinaturaGov
}
