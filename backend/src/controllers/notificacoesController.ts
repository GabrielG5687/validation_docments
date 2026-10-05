import { Request, Response, NextFunction } from 'express'
import prisma from '../config/prisma'

export async function listNotificacoes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const [data, naoLidas] = await Promise.all([
      prisma.notificacao.findMany({
        where: { destinatarioId: req.user.id },
        orderBy: { criadoEm: 'desc' },
        take: 50,
        include: { destinatario: { select: { id: true, nome: true } } },
      }),
      prisma.notificacao.count({ where: { destinatarioId: req.user.id, lida: false } }),
    ])
    res.json({ data, naoLidas })
  } catch (error) { next(error) }
}

export async function marcarLida(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const updated = await prisma.notificacao.updateMany({
      where: { id: req.params.id, destinatarioId: req.user.id },
      data: { lida: true },
    })
    if (!updated.count) {
      res.status(404).json({ error: 'Notificação não encontrada' })
      return
    }
    res.json({ id: req.params.id, lida: true })
  } catch (error) { next(error) }
}

export async function marcarTodasLidas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const result = await prisma.notificacao.updateMany({
      where: { destinatarioId: req.user.id, lida: false },
      data: { lida: true },
    })
    res.json({ atualizadas: result.count })
  } catch (error) { next(error) }
}

export default { listNotificacoes, marcarLida, marcarTodasLidas }