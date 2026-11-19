import { AlertCircle, CheckCircle, Clock, Eye, FileSearch, Loader2, XCircle } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { StatusDocumento } from '../types'
export const STATUS_CONFIG: Record<StatusDocumento, { label: string; colorClass: string; bgClass: string; icon: Component }> = {
  processando: { label: 'Lendo o arquivo', colorClass: 'text-sky-700', bgClass: 'bg-sky-50', icon: Loader2 },
  aguardando_validacao: { label: 'Em análise', colorClass: 'text-amber-700', bgClass: 'bg-amber-50', icon: Clock },
  aguardando_revisao: { label: 'Aguardando revisão', colorClass: 'text-amber-700', bgClass: 'bg-amber-50', icon: FileSearch },
  em_revisao: { label: 'Em revisão', colorClass: 'text-primary', bgClass: 'bg-primary-light', icon: Eye },
  aprovado: { label: 'Aprovado', colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', icon: CheckCircle },
  reprovado: { label: 'Reprovado', colorClass: 'text-red-700', bgClass: 'bg-red-50', icon: XCircle },
  reprovado_automatico: { label: 'Reprovado automaticamente', colorClass: 'text-red-700', bgClass: 'bg-red-50', icon: XCircle },
  erro_extracao: { label: 'Falha na leitura', colorClass: 'text-orange-700', bgClass: 'bg-orange-50', icon: AlertCircle },
}
