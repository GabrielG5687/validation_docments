import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'
import { montarStatusItens, resumirConformidadeItens } from '../services/dossieService'
import { diasEntre } from '../services/validadeService'
import { entidadeAcessivel, ehGestor, podeGerenciarEntidade, whereEntidadesVisiveis } from '../utils/entidadeAccess'

const entidadeSchema = z.object({
  tipo: z.enum(['empresa', 'pessoa']),
  nome: z.string().min(2).max(200),
  documentoIdentificador: z.string().max(60).optional(),
  cnpjOuCpf: z.string().max(20).optional(),
  responsavelId: z.string().uuid().optional(),
})

export async function listEntidades(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const where = whereEntidadesVisiveis(req.user.perfil, req.user.id, req.empresa?.id)
    const entidades = await prisma.entidade.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      include: {
        responsavel: { select: { id: true, nome: true, email: true } },
        dossies: { select: { id: true, nome: true } },
        _count: { select: { dossies: true, documentos: true } },
      },
    })
    const ids = entidades.map((entidade) => entidade.id)
    const itens = ids.length
      ? await prisma.dossieItem.findMany({
          where: { dossie: { entidadeId: { in: ids } } },
          select: { dossieId: true, templateId: true, obrigatorio: true, dossie: { select: { entidadeId: true } } },
        })
      : []

    const porEntidade = new Map<string, typeof itens>()
    for (const item of itens) {
      const entidadeId = item.dossie.entidadeId
      if (!porEntidade.has(entidadeId)) porEntidade.set(entidadeId, [])
      porEntidade.get(entidadeId)!.push(item)
    }

    const data = []
    for (const entidade of entidades) {
      const itensEntidade = porEntidade.get(entidade.id) ?? []
      const templateIds = [...new Set(itensEntidade.map((item) => item.templateId))]
      const mapa = await montarStatusItens(entidade.id, templateIds)
      const conformidade = resumirConformidadeItens(itensEntidade, mapa)
      data.push({ ...entidade, conformidade })
    }
    res.json({ data })
  } catch (error) { next(error) }
}

export async function createEntidade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const parsed = entidadeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'Dados da entidade inválidos', details: parsed.error.flatten() })
      return
    }
    const gestor = ehGestor(req.user.perfil)
    if (!gestor && req.user.perfil !== 'usuario') {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' })
      return
    }
    let responsavelId = req.user.id
    if (gestor && parsed.data.responsavelId) {
      const responsavel = await prisma.usuario.findFirst({
        where: { id: parsed.data.responsavelId, status: true },
        select: { id: true },
      })
      if (!responsavel) {
        res.status(422).json({ error: 'Responsável informado não existe ou está inativo' })
        return
      }
      responsavelId = responsavel.id
    }
    const { responsavelId: _ignored, ...rest } = parsed.data
    if (!req.empresa?.id) {
      res.status(400).json({ error: 'Nenhuma empresa disponível no contexto atual' })
      return
    }
    const entidade = await prisma.entidade.create({
      data: { ...rest, responsavelId, empresaId: req.empresa.id },
      select: { id: true, tipo: true, nome: true, criadoEm: true, responsavelId: true, empresaId: true },
    })
    res.status(201).json(entidade)
  } catch (error) { next(error) }
}

export async function detailEntidade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const entidade = await prisma.entidade.findUnique({
      where: { id: req.params.id },
      include: {
        responsavel: { select: { id: true, nome: true, email: true } },
        dossies: {
          orderBy: { criadoEm: 'desc' },
          include: { _count: { select: { itens: true } } },
        },
      },
    })
    if (!entidade) { res.status(404).json({ error: 'Entidade não encontrada' }); return }
    if (!(await entidadeAcessivel(entidade.id, req.user.perfil, req.user.id, req.empresa?.id))) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' }); return
    }
    res.json(entidade)
  } catch (error) { next(error) }
}

export async function updateEntidade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const parsed = entidadeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'Dados da entidade inválidos', details: parsed.error.flatten() })
      return
    }
    if (!(await podeGerenciarEntidade(req.params.id, req.user.perfil, req.user.id, req.empresa?.id))) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' }); return
    }
    const data = { ...parsed.data }
    if (!ehGestor(req.user.perfil)) {
      delete (data as Partial<typeof data>).responsavelId
    } else if (data.responsavelId) {
      const responsavel = await prisma.usuario.findFirst({
        where: { id: data.responsavelId, status: true },
        select: { id: true },
      })
      if (!responsavel) {
        res.status(422).json({ error: 'Responsável informado não existe ou está inativo' })
        return
      }
    }
    const entidade = await prisma.entidade.update({ where: { id: req.params.id }, data })
    res.json(entidade)
  } catch (error) { next(error) }
}

export async function deleteEntidade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await podeGerenciarEntidade(req.params.id, req.user.perfil, req.user.id, req.empresa?.id))) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' }); return
    }
    const counts = await prisma.$transaction([
      prisma.documento.count({ where: { entidadeId: req.params.id } }),
      prisma.dossie.count({ where: { entidadeId: req.params.id } }),
    ])
    if (counts[0] > 0 || counts[1] > 0) {
      res.status(409).json({ error: 'Entidade possui documentos ou dossiês vinculados' }); return
    }
    await prisma.entidade.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (error) { next(error) }
}

export async function conformidadeEntidade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const entidadeId = req.params.id
    if (!(await entidadeAcessivel(entidadeId, req.user.perfil, req.user.id, req.empresa?.id))) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' }); return
    }
    const dossies = await prisma.dossie.findMany({ where: { entidadeId }, select: { id: true, nome: true } })
    const dossieIds = dossies.map((dossie) => dossie.id)
    const itens = dossieIds.length
      ? await prisma.dossieItem.findMany({
          where: { dossieId: { in: dossieIds } },
          select: { id: true, dossieId: true, templateId: true, obrigatorio: true, ordem: true, template: { select: { nome: true } } },
          orderBy: { ordem: 'asc' },
        })
      : []
    const templateIds = [...new Set(itens.map((item) => item.templateId))]
    const mapa = await montarStatusItens(entidadeId, templateIds)
    const resumo = resumirConformidadeItens(itens, mapa)
    const detalhes = itens.map((item) => {
      const info = mapa.get(item.templateId)
      const doc = info?.documento
      const status = info?.status ?? 'faltando'
      return {
        id: item.id,
        dossieId: item.dossieId,
        dossieNome: dossies.find((dossie) => dossie.id === item.dossieId)?.nome,
        templateId: item.templateId,
        templateNome: item.template.nome,
        obrigatorio: item.obrigatorio,
        ordem: item.ordem,
        status,
        documento: doc
          ? {
              id: doc.id,
              nomeArquivo: doc.nomeArquivo,
              dataValidade: doc.dataValidade,
              statusValidade: doc.statusValidade,
              criadoEm: doc.criadoEm,
              diasParaVencer: doc.dataValidade ? diasEntre(new Date(), doc.dataValidade) : null,
            }
          : null,
      }
    })
    res.json({
      entidadeId,
      dossies: dossies.map((dossie) => ({ ...dossie, _count: { itens: itens.filter((item) => item.dossieId === dossie.id).length } })),
      totalItens: resumo.totalItens,
      obrigatorios: resumo.totalItens,
      atendidos: resumo.atendidos,
      faltando: resumo.faltando,
      vencidos: resumo.vencidos,
      percentual: resumo.percentual,
      itens: detalhes,
    })
  } catch (error) { next(error) }
}

export async function vencendoEntidade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const entidadeId = req.params.id
    if (!(await entidadeAcessivel(entidadeId, req.user.perfil, req.user.id, req.empresa?.id))) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' }); return
    }
    const parsed = z.object({ dias: z.coerce.number().int().min(1).max(365).default(30) }).safeParse(req.query)
    const limiteDias = parsed.success ? parsed.data.dias : 30
    const documentos = await prisma.documento.findMany({
      where: { entidadeId, dataValidade: { not: null }, status: 'aprovado' },
      select: {
        id: true,
        nomeArquivo: true,
        dataValidade: true,
        statusValidade: true,
        template: { select: { id: true, nome: true } },
      },
      orderBy: { dataValidade: 'asc' },
    })
    const hoje = new Date()
    const data = documentos
      .map((documento) => {
        if (!documento.dataValidade) return null
        const diasParaVencer = diasEntre(hoje, documento.dataValidade)
        return { ...documento, diasParaVencer }
      })
      .filter((documento): documento is NonNullable<typeof documento> => documento !== null && documento.diasParaVencer <= limiteDias)
      .sort((a, b) => a.diasParaVencer - b.diasParaVencer)
    res.json({ data })
  } catch (error) { next(error) }
}

export default { listEntidades, createEntidade, detailEntidade, updateEntidade, deleteEntidade, conformidadeEntidade, vencendoEntidade }
