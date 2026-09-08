import { Prisma } from '@prisma/client'
import { stringify } from 'csv-stringify/sync'
import prisma from '../config/prisma'

export interface ReportFilters {
  dataInicio?: Date
  dataFim?: Date
  templateId?: string
  validadorId?: string
  usuarioId?: string
}

function whereFor(filters: ReportFilters): Prisma.DocumentoWhereInput {
  return {
    ...(filters.templateId ? { templateId: filters.templateId } : {}),
    ...(filters.usuarioId ? { usuarioId: filters.usuarioId } : {}),
    ...(filters.dataInicio || filters.dataFim ? { criadoEm: { ...(filters.dataInicio ? { gte: filters.dataInicio } : {}), ...(filters.dataFim ? { lte: filters.dataFim } : {}) } } : {}),
    ...(filters.validadorId ? { validacoes: { some: { validadorId: filters.validadorId } } } : {}),
  }
}

export async function gerarMetricas(filters: ReportFilters = {}) {
  const documentos = await prisma.documento.findMany({
    where: whereFor(filters),
    include: {
      template: { select: { nome: true } },
      validacoes: { include: { validador: { select: { id: true, nome: true } } }, orderBy: { criadoEm: 'asc' } },
      historico: { orderBy: { criadoEm: 'asc' } },
    },
    orderBy: { criadoEm: 'asc' },
  })
  const aprovados = documentos.filter((d) => d.status === 'aprovado').length
  const reprovados = documentos.filter((d) => d.status === 'reprovado' || d.status === 'reprovado_automatico').length
  const finais = documentos.filter((d) => ['aprovado', 'reprovado', 'reprovado_automatico'].includes(d.status))
  const tempos = finais.map((d) => {
    const inicio = d.historico.find((h) => h.statusNovo === 'processando')?.criadoEm ?? d.criadoEm
    const fim = d.historico.filter((h) => ['aprovado', 'reprovado', 'reprovado_automatico'].includes(h.statusNovo)).pop()?.criadoEm
    return fim ? (fim.getTime() - inicio.getTime()) / 3600000 : undefined
  }).filter((value): value is number => value !== undefined && value >= 0)
  const templateMap = new Map<string, { enviados: number; aprovados: number; reprovados: number }>()
  const validatorMap = new Map<string, { nome: string; revisados: number; aprovados: number; reprovados: number }>()
  for (const doc of documentos) {
    const t = templateMap.get(doc.template.nome) ?? { enviados: 0, aprovados: 0, reprovados: 0 }
    t.enviados++; if (doc.status === 'aprovado') t.aprovados++; if (doc.status === 'reprovado' || doc.status === 'reprovado_automatico') t.reprovados++
    templateMap.set(doc.template.nome, t)
    const manual = doc.validacoes.filter((v) => v.validadorId !== undefined).pop()
    if (manual && manual.validador.nome !== 'Validação automática') {
      const v = validatorMap.get(manual.validador.id) ?? { nome: manual.validador.nome, revisados: 0, aprovados: 0, reprovados: 0 }
      v.revisados++; if (manual.resultado === 'aprovado') v.aprovados++; else v.reprovados++
      validatorMap.set(manual.validador.id, v)
    }
  }
  return {
    periodo: { inicio: filters.dataInicio?.toISOString().slice(0, 10) ?? null, fim: filters.dataFim?.toISOString().slice(0, 10) ?? null },
    totais: {
      enviados: documentos.length, aprovados, reprovados,
      emProcessamento: documentos.filter((d) => !['aprovado', 'reprovado', 'reprovado_automatico'].includes(d.status)).length,
      taxaAprovacao: documentos.length ? Number(((aprovados / documentos.length) * 100).toFixed(2)) : 0,
      tempoMedioHoras: tempos.length ? Number((tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(2)) : 0,
    },
    porTemplate: [...templateMap.entries()].map(([template, values]) => ({ template, ...values })),
    porValidador: [...validatorMap.values()],
    documentos,
  }
}

export async function exportarCSV(filters: ReportFilters = {}): Promise<string> {
  const report = await gerarMetricas(filters)
  return stringify(report.documentos.map((d) => ({
    id: d.id, nomeArquivo: d.nomeArquivo, template: d.template.nome, usuarioId: d.usuarioId,
    status: d.status, hashSha256: d.hashSha256, criadoEm: d.criadoEm.toISOString(),
  })), { header: true })
}

export default { gerarMetricas, exportarCSV }
