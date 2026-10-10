import type { Template } from '../types'

export type TemplateBadge = {
  key: 'ativo' | 'rascunho' | 'inativo' | 'revisao'
  label: string
  className: string
}

export function templateBadge(template: Pick<Template, 'status' | '_count'>): TemplateBadge {
  if (template.status === 'ativo') return { key: 'ativo', label: 'Ativo', className: 'bg-emerald-50 text-emerald-700' }
  if (template.status === 'inativo') return { key: 'inativo', label: 'Desativado', className: 'bg-slate-100 text-slate-600' }
  if ((template._count?.versoes ?? 0) > 0) return { key: 'revisao', label: 'Em revisão', className: 'bg-violet-50 text-violet-700' }
  return { key: 'rascunho', label: 'Rascunho', className: 'bg-amber-50 text-amber-700' }
}

export function relativeTime(value?: string | Date) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Atualizado agora'
  if (minutes < 60) return `Atualizado há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? 'Atualizado há 1 hora' : `Atualizado há ${hours} horas`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Atualizado ontem'
  if (days < 7) return `Atualizado há ${days} dias`
  return `Atualizado em ${date.toLocaleDateString('pt-BR')}`
}
