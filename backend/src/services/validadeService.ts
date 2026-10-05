import { Prisma, ValidadeStatus } from '@prisma/client'
import prisma from '../config/prisma'
import { criarNotificacao } from './notificacaoService'

export const VALIDADE_MARGEM_ALERTA_DIAS = Number(process.env.VALIDADE_MARGEM_ALERTA_DIAS ?? 30)

export const CAMPO_DATA_EMISSAO = ['data_emissao', 'data_emissao_doc', 'emissao']
export const CAMPO_DATA_VALIDADE = ['data_validade', 'data_vencimento', 'vencimento', 'data_validade_doc', 'validade']

export function parseData(valor: unknown): Date | null {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  if (typeof valor !== 'string') return null
  const text = valor.trim()
  if (!text) return null
  // BR primeiro: Date.parse interpreta 03/10/2026 como MM/DD (EUA)
  const br = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (br) {
    const ano = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])
    const date = new Date(ano, Number(br[2]) - 1, Number(br[1]), 12)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const iso = Date.parse(text)
  if (!Number.isNaN(iso)) return new Date(iso)
  return null
}

export function diasEntre(hoje: Date, data: Date): number {
  const a = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12)
  const b = new Date(data.getFullYear(), data.getMonth(), data.getDate(), 12)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function calcularStatus(dataValidade: Date | null | undefined, hoje: Date = new Date(), margemDias: number = VALIDADE_MARGEM_ALERTA_DIAS): { statusValidade: ValidadeStatus | null; diasParaVencer: number | null } {
  if (!dataValidade) return { statusValidade: null, diasParaVencer: null }
  const dias = diasEntre(hoje, dataValidade)
  if (dias < 0) return { statusValidade: 'vencido', diasParaVencer: dias }
  if (dias <= margemDias) return { statusValidade: 'proximo_vencimento', diasParaVencer: dias }
  return { statusValidade: 'valido', diasParaVencer: dias }
}

function primeiraData(dados: Record<string, unknown>, chaves: string[]): Date | null {
  for (const chave of chaves) {
    const valor = dados[chave]
    if (valor === undefined || valor === null || valor === '') continue
    const data = parseData(valor)
    if (data) return data
  }
  return null
}

export function derivarValidade(dadosExtraidos: Record<string, unknown> | null | undefined, validadeDias?: number | null): { dataEmissao: Date | null; dataValidade: Date | null } {
  const dados = dadosExtraidos ?? {}
  const dataValidade = primeiraData(dados, CAMPO_DATA_VALIDADE)
  const dataEmissao = primeiraData(dados, CAMPO_DATA_EMISSAO)
  if (dataValidade) return { dataEmissao, dataValidade }
  if (dataEmissao && validadeDias && validadeDias > 0) {
    const calculada = new Date(dataEmissao.getTime())
    calculada.setDate(calculada.getDate() + validadeDias)
    return { dataEmissao, dataValidade: calculada }
  }
  return { dataEmissao, dataValidade: null }
}

export function calcularValidadeDocumento(dadosExtraidos: Record<string, unknown> | null | undefined, validadeDias?: number | null, hoje?: Date) {
  const { dataEmissao, dataValidade } = derivarValidade(dadosExtraidos, validadeDias)
  const { statusValidade, diasParaVencer } = calcularStatus(dataValidade, hoje)
  return { dataEmissao, dataValidade, statusValidade, diasParaVencer }
}

export async function recalcularValidades(hoje: Date = new Date()): Promise<number> {
  const documentos = await prisma.documento.findMany({
    where: { dataValidade: { not: null } },
    select: {
      id: true,
      templateId: true,
      usuarioId: true,
      dataValidade: true,
      statusValidade: true,
      renovacaoNecessaria: true,
      diasParaVencer: true,
      nomeArquivo: true,
      entidade: { select: { id: true, nome: true } },
      template: { select: { nome: true } },
    },
  })

  const atualizacoes: Prisma.PrismaPromise<unknown>[] = []
  const entidadesAfetadas = new Set<string>()
  let notificadas = 0

  for (const documento of documentos) {
    const anterior = documento.statusValidade
    const { statusValidade, diasParaVencer } = calcularStatus(documento.dataValidade, hoje)
    const renovacaoNecessaria = statusValidade === 'vencido'
    if (anterior === statusValidade && (documento.renovacaoNecessaria ?? false) === renovacaoNecessaria && documento.diasParaVencer === diasParaVencer) continue
    atualizacoes.push(
      prisma.documento.update({
        where: { id: documento.id },
        data: { statusValidade, diasParaVencer, renovacaoNecessaria },
      })
    )
    if (documento.entidade?.id && (statusValidade === 'vencido') !== (anterior === 'vencido')) {
      entidadesAfetadas.add(documento.entidade.id)
    }
    if (statusValidade === 'vencido' && anterior !== 'vencido') {
      const contexto = documento.entidade ? ` da entidade ${documento.entidade.nome}` : ''
      atualizacoes.push(
        criarNotificacao({
          destinatarioId: documento.usuarioId,
          tipo: 'vencimento',
          titulo: 'Documento vencido',
          mensagem: `O documento ${documento.nomeArquivo}${contexto} venceu. Solicite um novo documento.`,
          documentoId: documento.id,
          entidadeId: documento.entidade?.id,
        })
      )
      notificadas += 1
    }
  }

  if (atualizacoes.length) await prisma.$transaction(atualizacoes)
  if (entidadesAfetadas.size) {
    const { sincronizarStatusDossiesEntidade } = await import('./dossieService')
    for (const entidadeId of entidadesAfetadas) {
      await sincronizarStatusDossiesEntidade(entidadeId)
    }
  }
  return notificadas
}