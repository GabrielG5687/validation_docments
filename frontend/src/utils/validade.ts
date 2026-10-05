import type { ValidadeStatus } from '../types'

export function rotuloValidade(status?: ValidadeStatus | null, dias?: number | null): string | null {
  if (status === 'valido') return 'Válido'
  if (status === 'proximo_vencimento') {
    if (dias === 0) return 'Vence hoje'
    if (dias === 1) return 'Vence amanhã'
    return dias != null ? `Vence em ${dias} dias` : 'Próximo do vencimento'
  }
  if (status === 'vencido') return dias != null && dias < 0 ? `Vencido há ${-dias} dias` : 'Vencido'
  return null
}

export function corValidade(status?: ValidadeStatus | null): { text: string; bg: string; dot: string } {
  switch (status) {
    case 'valido':
      return { text: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-500' }
    case 'proximo_vencimento':
      return { text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' }
    case 'vencido':
      return { text: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' }
    default:
      return { text: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' }
  }
}

export default { rotuloValidade, corValidade }