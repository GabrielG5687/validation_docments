import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'
import { exportarCSV, gerarMetricas } from '../services/reportService'

const filtersSchema = z.object({
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
  templateId: z.string().uuid().optional(),
  validadorId: z.string().uuid().optional(),
  usuarioId: z.string().uuid().optional(),
})

function filters(req: Request) {
  const parsed = filtersSchema.safeParse(req.query)
  if (!parsed.success) throw Object.assign(new Error('Parâmetros de relatório inválidos'), { status: 422 })
  return parsed.data
}

export async function relatorio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { documentos: _documentos, ...publicReport } = await gerarMetricas(filters(req))
    res.json(publicReport)
  } catch (error) { next(error) }
}

export async function relatorioCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const csv = await exportarCSV(filters(req))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio.csv')
    res.send(csv)
  } catch (error) { next(error) }
}

export async function dashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const perfil = req.user.perfil
    if (perfil === 'usuario') {
      const docs = await prisma.documento.findMany({ where: { usuarioId: req.user.id }, orderBy: { criadoEm: 'desc' }, take: 5, select: { id: true, nomeArquivo: true, status: true, criadoEm: true } })
      const [total, aguardandoRevisao, aprovados, reprovados] = await Promise.all([
        prisma.documento.count({ where: { usuarioId: req.user.id } }),
        prisma.documento.count({ where: { usuarioId: req.user.id, status: 'aguardando_revisao' } }),
        prisma.documento.count({ where: { usuarioId: req.user.id, status: 'aprovado' } }),
        prisma.documento.count({ where: { usuarioId: req.user.id, status: { in: ['reprovado', 'reprovado_automatico'] } } }),
      ])
      res.json({ perfil, contadores: { total, aguardandoRevisao, aprovados, reprovados }, ultimosDocumentos: docs }); return
    }
    if (perfil === 'validador') {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
      const [fila, revisadosHoje, revisados] = await Promise.all([
        prisma.documento.count({ where: { status: 'aguardando_revisao' } }),
        prisma.validacao.count({ where: { validadorId: req.user.id, criadoEm: { gte: hoje } } }),
        prisma.validacao.findMany({
          where: { validadorId: req.user.id, resultado: { in: ['aprovado', 'reprovado'] } },
          select: { documentoId: true, criadoEm: true },
          orderBy: { criadoEm: 'asc' },
        }),
      ])
      const ids = revisados.map((item) => item.documentoId)
      const historicos = ids.length
        ? await prisma.historicoStatus.findMany({ where: { documentoId: { in: ids }, statusNovo: { in: ['em_revisao', 'aprovado', 'reprovado'] } }, orderBy: { criadoEm: 'asc' } })
        : []
      const durations: number[] = []
      for (const id of new Set(ids)) {
        const history = historicos.filter((item) => item.documentoId === id)
        const start = history.find((item) => item.statusNovo === 'em_revisao')
        const end = history.find((item) => item.statusNovo === 'aprovado' || item.statusNovo === 'reprovado')
        if (start && end && end.criadoEm >= start.criadoEm) durations.push(end.criadoEm.getTime() - start.criadoEm.getTime())
      }
      res.json({ perfil, fila: { aguardandoRevisao: fila, revisadosHoje, tempoMedioRevisaoHoras: durations.length ? Number((durations.reduce((a, b) => a + b, 0) / durations.length / 3600000).toFixed(2)) : 0 } }); return
    }
    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
    const metricas = await gerarMetricas(perfil === 'coordenador' ? { dataInicio: inicioMes, dataFim: now } : {})
    if (perfil === 'coordenador') {
      const { documentos: _documentos, ...publicMetricas } = metricas
      res.json({ perfil, metricas: publicMetricas }); return
    }
    const [templatesAtivos, usuariosPorPerfil] = await Promise.all([
      prisma.template.count({ where: { status: 'ativo' } }),
      prisma.usuario.groupBy({ by: ['perfil'], _count: { _all: true } }),
    ])
    const { documentos: _documentos, ...publicMetricas } = metricas
    res.json({ perfil, metricas: publicMetricas, templatesAtivos, usuariosPorPerfil })
  } catch (error) { next(error) }
}
