import type { StatusDocumento } from '../types'

export type DocumentoNextStep = {
  title: string
  body: string
  tone: 'info' | 'warning' | 'success' | 'danger' | 'neutral'
}

/** Orienta o usuário comum sobre o que fazer (ou esperar) em cada status. */
export function documentoNextStep(status: StatusDocumento | string, podeRevisar = false): DocumentoNextStep {
  switch (status) {
    case 'processando':
    case 'aguardando_validacao':
      return {
        title: 'Análise em andamento',
        body: 'Estamos lendo o PDF e aplicando as regras do modelo. Você pode acompanhar esta página; ela atualiza sozinha.',
        tone: 'info',
      }
    case 'aguardando_revisao':
      return podeRevisar
        ? {
            title: 'Sua vez de revisar',
            body: 'A checagem automática terminou. Confira o PDF e as regras abaixo e registre o parecer.',
            tone: 'warning',
          }
        : {
            title: 'Aguardando um revisor',
            body: 'Seu envio passou pela análise automática e está na fila de alguém da organização. Não é preciso reenviar agora.',
            tone: 'warning',
          }
    case 'em_revisao':
      return podeRevisar
        ? {
            title: 'Revisão em curso',
            body: 'Finalize o parecer: aprove se estiver conforme ou reprove informando o motivo.',
            tone: 'warning',
          }
        : {
            title: 'Em revisão humana',
            body: 'Um revisor está analisando este documento. Você será notificado quando houver decisão.',
            tone: 'info',
          }
    case 'aprovado':
      return {
        title: 'Documento aprovado',
        body: 'Use o código de verificação ou o QR Code para comprovar a validade quando alguém solicitar.',
        tone: 'success',
      }
    case 'reprovado':
    case 'reprovado_automatico':
      return {
        title: 'Documento reprovado',
        body: 'Veja o motivo nas regras e no parecer. Corrija o PDF e envie uma nova versão, se necessário.',
        tone: 'danger',
      }
    case 'erro_extracao':
      return {
        title: 'Não conseguimos ler o arquivo',
        body: 'O PDF pode estar corrompido, escaneado sem texto ou inacessível. Tente outro arquivo ou um PDF com texto selecionável.',
        tone: 'danger',
      }
    default:
      return {
        title: 'Status do documento',
        body: 'Acompanhe o histórico e os resultados abaixo para entender o andamento.',
        tone: 'neutral',
      }
  }
}

export type StatusFilterGroup = '' | 'andamento' | 'atencao' | 'aprovado' | 'reprovado'

const GROUP_STATUS: Record<Exclude<StatusFilterGroup, ''>, StatusDocumento[]> = {
  andamento: ['processando', 'aguardando_validacao'],
  atencao: ['aguardando_revisao', 'em_revisao', 'erro_extracao'],
  aprovado: ['aprovado'],
  reprovado: ['reprovado', 'reprovado_automatico'],
}

export function statusMatchesGroup(status: string, group: StatusFilterGroup): boolean {
  if (!group) return true
  return GROUP_STATUS[group].includes(status as StatusDocumento)
}

export const STATUS_FILTER_OPTIONS: { value: StatusFilterGroup; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'andamento', label: 'Em análise' },
  { value: 'atencao', label: 'Precisa de atenção' },
  { value: 'aprovado', label: 'Aprovados' },
  { value: 'reprovado', label: 'Reprovados' },
]

/** Texto curto para listas — o usuário vê o que fazer sem abrir o detalhe. */
export function documentoNextStepHint(status: StatusDocumento | string, podeRevisar = false): string {
  switch (status) {
    case 'processando':
    case 'aguardando_validacao':
      return 'Aguarde a análise'
    case 'aguardando_revisao':
      return podeRevisar ? 'Revisar agora' : 'Na fila de revisão'
    case 'em_revisao':
      return podeRevisar ? 'Concluir parecer' : 'Em revisão humana'
    case 'aprovado':
      return 'Pronto para comprovar'
    case 'reprovado':
    case 'reprovado_automatico':
      return 'Corrigir e reenviar'
    case 'erro_extracao':
      return 'Trocar o arquivo'
    default:
      return 'Ver detalhes'
  }
}
