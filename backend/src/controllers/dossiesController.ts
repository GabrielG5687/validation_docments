import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'
import { entidadeAcessivel, podeGerenciarEntidade, whereEntidadesVisiveis } from '../utils/entidadeAccess'
import { montarStatusItens, statusDossie, sincronizarStatusDossie } from '../services/dossieService'
import { criarNotificacao } from '../services/notificacaoService'
import { createDocument } from './documentosController'

const dossieSchema = z.object({
  entidadeId: z.string().uuid(),
  nome: z.string().min(2).max(200),
  descricao: z.string().max(1000).optional(),
  itens: z.array(z.object({
    templateId: z.string().uuid(),
    obrigatorio: z.boolean().optional().default(true),
  })).min(1).max(100).optional(),
})

const itemSchema = z.object({
  templateId: z.string().uuid(),
  obrigatorio: z.boolean().optional().default(true),
})

async function dossieComGerenciamento(req: Request, res: Response): Promise<{ entidadeId: string } | null> {
  const dossie = await prisma.dossie.findUnique({ where: { id: req.params.id }, select: { entidadeId: true } })
  if (!dossie) {
    res.status(404).json({ error: 'Dossiê não encontrado' })
    return null
  }
  if (!req.user || !(await podeGerenciarEntidade(dossie.entidadeId, req.user.perfil, req.user.id, req.empresa?.id))) {
    res.status(403).json({ error: 'Acesso negado para o perfil atual' })
    return null
  }
  return dossie
}

async function dossieComLeitura(req: Request, res: Response): Promise<{ entidadeId: string } | null> {
  const dossie = await prisma.dossie.findUnique({ where: { id: req.params.id }, select: { entidadeId: true } })
  if (!dossie) {
    res.status(404).json({ error: 'Dossiê não encontrado' })
    return null
  }
  if (!req.user || !(await entidadeAcessivel(dossie.entidadeId, req.user.perfil, req.user.id, req.empresa?.id))) {
    res.status(403).json({ error: 'Acesso negado para o perfil atual' })
    return null
  }
  return dossie
}

export async function listDossies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const parsed = z.object({ entidadeId: z.string().uuid().optional() }).safeParse(req.query)
    const visivel = whereEntidadesVisiveis(req.user.perfil, req.user.id, req.empresa?.id)
    const where = {
      ...(Object.keys(visivel).length ? { entidade: visivel } : {}),
      ...(parsed.success && parsed.data.entidadeId ? { entidadeId: parsed.data.entidadeId } : {}),
    }
    const dossies = await prisma.dossie.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      include: {
        entidade: { select: { id: true, nome: true, tipo: true } },
        itens: { include: { template: { select: { id: true, nome: true } } }, orderBy: { ordem: 'asc' } },
        _count: { select: { itens: true } },
      },
    })
    const porEntidade = new Map<string, Array<typeof dossies[number]>>()
    for (const dossie of dossies) {
      if (!porEntidade.has(dossie.entidadeId)) porEntidade.set(dossie.entidadeId, [])
      porEntidade.get(dossie.entidadeId)!.push(dossie)
    }
    const data: Array<Record<string, unknown>> = []
    for (const [entidadeId, grupo] of porEntidade) {
      const templateIds = [...new Set(grupo.flatMap((dossie) => dossie.itens.map((item) => item.templateId)))]
      const mapa = await montarStatusItens(entidadeId, templateIds)
      for (const dossie of grupo) {
        const itens = dossie.itens.map((item) => ({
          id: item.id,
          dossieId: dossie.id,
          templateId: item.templateId,
          templateNome: item.template.nome,
          obrigatorio: item.obrigatorio,
          ordem: item.ordem,
          status: mapa.get(item.templateId)?.status ?? 'faltando',
          documento: mapa.get(item.templateId)?.documento ?? null,
        }))
        const status = statusDossie(itens)
        if (status !== dossie.status) {
          await prisma.dossie.update({ where: { id: dossie.id }, data: { status } })
        }
        data.push({ ...dossie, itens, status })
      }
    }
    res.json({ data })
  } catch (error) { next(error) }
}

export async function createDossie(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const parsed = dossieSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'Dados do dossiê inválidos', details: parsed.error.flatten() })
      return
    }
    const { entidadeId, nome, descricao, itens } = parsed.data
    if (!(await podeGerenciarEntidade(entidadeId, req.user.perfil, req.user.id, req.empresa?.id))) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' })
      return
    }
    const templateIds = itens?.map((item) => item.templateId) ?? []
    if (new Set(templateIds).size !== templateIds.length) {
      res.status(422).json({ error: 'Há templates duplicados no dossiê' })
      return
    }
    const templates = templateIds.length
      ? await prisma.template.findMany({ where: { id: { in: templateIds } }, select: { id: true } })
      : []
    if (templateIds.length && templates.length !== templateIds.length) {
      res.status(422).json({ error: 'Um ou mais templates informados não existem' })
      return
    }
    const dossie = await prisma.$transaction(async (tx) => {
      const criado = await tx.dossie.create({ data: { entidadeId, nome, descricao, status: 'pendente' } })
      if (itens?.length) {
        await tx.dossieItem.createMany({
          data: itens.map((item, index) => ({
            dossieId: criado.id,
            templateId: item.templateId,
            obrigatorio: item.obrigatorio,
            ordem: index + 1,
          })),
        })
      }
      return criado
    })
    const status = await sincronizarStatusDossie(dossie.id)
    res.status(201).json({ ...dossie, status })
  } catch (error) { next(error) }
}

export async function detailDossie(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await dossieComLeitura(req, res))) return
    const dossie = await prisma.dossie.findUnique({
      where: { id: req.params.id },
      include: {
        entidade: { select: { id: true, nome: true, tipo: true, documentoIdentificador: true } },
        itens: { include: { template: { select: { id: true, nome: true } } }, orderBy: { ordem: 'asc' } },
      },
    })
    if (!dossie) { res.status(404).json({ error: 'Dossiê não encontrado' }); return }
    const mapa = await montarStatusItens(dossie.entidadeId, dossie.itens.map((item) => item.templateId))
    const itens = dossie.itens.map((item) => ({
      id: item.id,
      templateId: item.templateId,
      templateNome: item.template.nome,
      obrigatorio: item.obrigatorio,
      ordem: item.ordem,
      status: mapa.get(item.templateId)?.status ?? 'faltando',
      documento: mapa.get(item.templateId)?.documento ?? null,
    }))
    const status = statusDossie(itens)
    if (status !== dossie.status) {
      await prisma.dossie.update({ where: { id: dossie.id }, data: { status } })
    }
    res.json({ ...dossie, itens, status })
  } catch (error) { next(error) }
}

export async function checklistDossie(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await dossieComLeitura(req, res))) return
    const dossie = await prisma.dossie.findUnique({
      where: { id: req.params.id },
      select: { entidadeId: true },
    })
    if (!dossie) { res.status(404).json({ error: 'Dossiê não encontrado' }); return }
    const itens = await prisma.dossieItem.findMany({
      where: { dossieId: req.params.id },
      include: { template: { select: { id: true, nome: true } } },
      orderBy: { ordem: 'asc' },
    })
    const mapa = await montarStatusItens(dossie.entidadeId, itens.map((item) => item.templateId))
    const data = itens.map((item) => ({
      id: item.id,
      templateId: item.templateId,
      templateNome: item.template.nome,
      obrigatorio: item.obrigatorio,
      ordem: item.ordem,
      status: mapa.get(item.templateId)?.status ?? 'faltando',
      documento: mapa.get(item.templateId)?.documento ?? null,
    }))
    const status = statusDossie(data)
    await prisma.dossie.update({ where: { id: req.params.id }, data: { status } })
    res.json({ data, status })
  } catch (error) { next(error) }
}

export async function updateDossie(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await dossieComGerenciamento(req, res))) return
    const parsed = z.object({ nome: z.string().min(2).max(200).optional(), descricao: z.string().max(1000).optional().nullable() }).safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'Dados do dossiê inválidos', details: parsed.error.flatten() })
      return
    }
    const dossie = await prisma.dossie.update({ where: { id: req.params.id }, data: parsed.data })
    res.json(dossie)
  } catch (error) { next(error) }
}

export async function deleteDossie(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await dossieComGerenciamento(req, res))) return
    await prisma.$transaction(async (tx) => {
      await tx.dossieItem.deleteMany({ where: { dossieId: req.params.id } })
      await tx.dossie.delete({ where: { id: req.params.id } })
    })
    res.status(204).end()
  } catch (error) { next(error) }
}

export async function adicionarItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await dossieComGerenciamento(req, res))) return
    const parsed = itemSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'Item inválido', details: parsed.error.flatten() })
      return
    }
    const template = await prisma.template.findUnique({ where: { id: parsed.data.templateId }, select: { id: true } })
    if (!template) { res.status(422).json({ error: 'Template não encontrado' }); return }
    const duplicado = await prisma.dossieItem.findFirst({
      where: { dossieId: req.params.id, templateId: parsed.data.templateId },
      select: { id: true },
    })
    if (duplicado) {
      res.status(409).json({ error: 'Este template já está no dossiê' })
      return
    }
    const ultimaOrdem = await prisma.dossieItem.findFirst({
      where: { dossieId: req.params.id },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    })
    const item = await prisma.dossieItem.create({
      data: { dossieId: req.params.id, templateId: parsed.data.templateId, obrigatorio: parsed.data.obrigatorio, ordem: (ultimaOrdem?.ordem ?? 0) + 1 },
    })
    await sincronizarStatusDossie(req.params.id)
    res.status(201).json(item)
  } catch (error) { next(error) }
}

export async function removerItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await prisma.dossieItem.findUnique({ where: { id: req.params.itemId }, select: { dossieId: true } })
    if (!item) { res.status(404).json({ error: 'Item não encontrado' }); return }
    req.params.id = item.dossieId
    if (!(await dossieComGerenciamento(req, res))) return
    await prisma.dossieItem.delete({ where: { id: req.params.itemId } })
    await sincronizarStatusDossie(item.dossieId)
    res.status(204).end()
  } catch (error) { next(error) }
}

export async function requisitarDocumentos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await dossieComGerenciamento(req, res))) return
    const parsed = z.object({ dossieItemId: z.string().uuid().optional() }).safeParse(req.body)
    const alvoId = parsed.success ? parsed.data.dossieItemId : undefined
    const dossie = await prisma.dossie.findUnique({
      where: { id: req.params.id },
      include: {
        entidade: { select: { id: true, nome: true, responsavelId: true } },
        itens: { include: { template: { select: { nome: true } } }, orderBy: { ordem: 'asc' } },
      },
    })
    if (!dossie) { res.status(404).json({ error: 'Dossiê não encontrado' }); return }
    const mapa = await montarStatusItens(dossie.entidadeId, dossie.itens.map((item) => item.templateId))
    const alvos = (alvoId ? dossie.itens.filter((item) => item.id === alvoId) : dossie.itens).filter((item) => {
      const status = mapa.get(item.templateId)?.status
      return status === 'faltando' || status === 'vencido'
    })
    if (!alvos.length) {
      if (alvoId) { res.status(404).json({ error: 'Item não encontrado ou já em dia' }); return }
      res.status(200).json({ solicitados: 0, mensagem: 'Nenhum documento pendente no dossiê.' })
      return
    }
    const destino = dossie.entidade.responsavelId
    if (!destino) {
      res.status(422).json({ error: 'Entidade não possui responsável para receber a solicitação' })
      return
    }
    await prisma.$transaction(
      alvos.map((item) => criarNotificacao({
        destinatarioId: destino,
        tipo: 'requisicao',
        titulo: 'Documento solicitado',
        mensagem: `A entidade ${dossie.entidade.nome} precisa enviar o documento "${item.template.nome}" para o dossiê "${dossie.nome}".`,
        dossieId: dossie.id,
        entidadeId: dossie.entidade.id,
      }))
    )
    res.json({ solicitados: alvos.length })
  } catch (error) { next(error) }
}

export async function uploadParametrizado(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const dossieId = req.params.id
    const dossieItemId = typeof req.body?.dossieItemId === 'string' ? req.body.dossieItemId : undefined
    if (!dossieItemId) {
      res.status(422).json({ error: 'dossieItemId é obrigatório' })
      return
    }
    const item = await prisma.dossieItem.findUnique({
      where: { id: dossieItemId },
      include: { dossie: { select: { entidadeId: true } } },
    })
    if (!item || item.dossieId !== dossieId) {
      res.status(422).json({ error: 'O item não pertence ao dossiê informado' })
      return
    }
    if (!(await podeGerenciarEntidade(item.dossie.entidadeId, req.user.perfil, req.user.id, req.empresa?.id))) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' })
      return
    }
    req.body = { ...req.body, dossieItemId: item.id, templateId: item.templateId }
    await createDocument(req, res, next)
  } catch (error) { next(error) }
}

export default { listDossies, createDossie, detailDossie, checklistDossie, updateDossie, deleteDossie, adicionarItem, removerItem, requisitarDocumentos, uploadParametrizado }
