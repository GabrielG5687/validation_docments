import { DossieStatus } from '@prisma/client'
import prisma from '../config/prisma'
import { diasEntre } from './validadeService'

export type StatusItemChecklist = 'atendido' | 'faltando' | 'vencido'

export type ItemStatus = {
  status: StatusItemChecklist
  documento?: {
    id: string
    nomeArquivo: string
    dataValidade: Date | null
    statusValidade: unknown
    criadoEm: Date
    diasParaVencer?: number | null
  }
}

export async function montarStatusItens(entidadeId: string, templateIds: string[]): Promise<Map<string, ItemStatus>> {
  const mapa = new Map<string, ItemStatus>()
  for (const templateId of templateIds) {
    mapa.set(templateId, { status: 'faltando' })
  }
  if (!templateIds.length) return mapa
  const aprovados = await prisma.documento.findMany({
    where: { entidadeId, templateId: { in: templateIds }, status: 'aprovado' },
    select: { id: true, templateId: true, nomeArquivo: true, dataValidade: true, statusValidade: true, criadoEm: true },
    orderBy: { criadoEm: 'desc' },
  })
  const vistos = new Set<string>()
  for (const doc of aprovados) {
    if (vistos.has(doc.templateId) || !mapa.has(doc.templateId)) continue
    vistos.add(doc.templateId)
    const vencido = doc.statusValidade === 'vencido'
    const diasParaVencer = doc.dataValidade ? diasEntre(new Date(), doc.dataValidade) : null
    mapa.set(doc.templateId, {
      status: vencido ? 'vencido' : 'atendido',
      documento: {
        id: doc.id,
        nomeArquivo: doc.nomeArquivo,
        dataValidade: doc.dataValidade,
        statusValidade: doc.statusValidade,
        criadoEm: doc.criadoEm,
        diasParaVencer,
      },
    })
  }
  return mapa
}

export function statusDossie(itens: Array<{ status: StatusItemChecklist; obrigatorio: boolean }>): DossieStatus {
  const obrigatorios = itens.filter((item) => item.obrigatorio)
  if (!obrigatorios.length) return 'pendente'
  const emDia = obrigatorios.every((item) => item.status === 'atendido')
  return emDia ? 'em_compliance' : 'pendente'
}

export function resumirConformidadeItens(
  itens: Array<{ templateId: string; obrigatorio: boolean }>,
  mapa: Map<string, ItemStatus>,
): { totalItens: number; atendidos: number; faltando: number; vencidos: number; percentual: number } {
  const obrigatorios = itens.filter((item) => item.obrigatorio)
  let atendidos = 0
  let faltando = 0
  let vencidos = 0
  for (const item of obrigatorios) {
    const status = mapa.get(item.templateId)?.status ?? 'faltando'
    if (status === 'atendido') atendidos += 1
    else if (status === 'vencido') vencidos += 1
    else faltando += 1
  }
  const totalItens = obrigatorios.length
  return {
    totalItens,
    atendidos,
    faltando,
    vencidos,
    percentual: totalItens ? Math.round((atendidos / totalItens) * 100) : 0,
  }
}

export async function sincronizarStatusDossie(dossieId: string): Promise<DossieStatus> {
  const dossie = await prisma.dossie.findUnique({
    where: { id: dossieId },
    select: { entidadeId: true, itens: { select: { templateId: true, obrigatorio: true } } },
  })
  if (!dossie) return 'pendente'
  const mapa = await montarStatusItens(dossie.entidadeId, dossie.itens.map((item) => item.templateId))
  const itens = dossie.itens.map((item) => ({
    status: (mapa.get(item.templateId)?.status ?? 'faltando') as StatusItemChecklist,
    obrigatorio: item.obrigatorio,
  }))
  const status = statusDossie(itens)
  await prisma.dossie.update({ where: { id: dossieId }, data: { status } })
  return status
}

export async function sincronizarStatusDossiesEntidade(entidadeId: string): Promise<void> {
  const dossies = await prisma.dossie.findMany({ where: { entidadeId }, select: { id: true } })
  for (const dossie of dossies) {
    await sincronizarStatusDossie(dossie.id)
  }
}

export default {
  montarStatusItens,
  statusDossie,
  resumirConformidadeItens,
  sincronizarStatusDossie,
  sincronizarStatusDossiesEntidade,
}
