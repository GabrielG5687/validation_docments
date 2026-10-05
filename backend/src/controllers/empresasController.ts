import { Request, Response, NextFunction } from 'express'
import { PapelEmpresa } from '@prisma/client'
import { z } from 'zod'
import prisma from '../config/prisma'
import {
  garantirWorkspacePadrao,
  listarEmpresasDoUsuario,
  marcarConvitesExpirados,
  obterMembro,
  statusConviteDerivado,
} from '../services/empresaService'
import { gerarTokenConvite, hashTokenConvite } from '../utils/inviteToken'
import { papeisConvidaveis, PERMISSOES, permissoesDoPapel, temPermissao } from '../utils/empresaPermissions'

const CONVITE_VALIDADE_MS = 48 * 60 * 60 * 1000

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '')
}

async function carregarEmpresaAutorizada(req: Request, res: Response, permissao?: string): Promise<boolean> {
  if (!req.user) return false
  const empresaId = req.params.id
  const membro = await obterMembro(empresaId, req.user.id)
  if (!membro) {
    res.status(403).json({ error: 'Você não é membro desta empresa' })
    return false
  }
  req.empresa = {
    id: membro.empresa.id,
    nome: membro.empresa.nome,
    papel: membro.papel,
    membroId: membro.id,
    permissoes: permissoesDoPapel(membro.papel),
  }
  if (permissao && !temPermissao(membro.papel, permissao as never)) {
    res.status(403).json({ error: 'Acesso negado para o papel na empresa atual' })
    return false
  }
  return true
}

export async function listMinhasEmpresas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const data = await garantirWorkspacePadrao(req.user.id, req.user.nome)
    res.json({ data })
  } catch (error) { next(error) }
}

export async function listMembros(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await carregarEmpresaAutorizada(req, res, PERMISSOES.MEMBERS_VIEW))) return

    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
    const papelFiltro = typeof req.query.papel === 'string' ? req.query.papel.toUpperCase() : ''

    const membros = await prisma.membroEmpresa.findMany({
      where: { empresaId: req.params.id },
      orderBy: [{ papel: 'asc' }, { criadoEm: 'asc' }],
      include: {
        usuario: { select: { id: true, nome: true, email: true, status: true, criadoEm: true } },
      },
    })

    let data = membros.map((m) => ({
      id: m.id,
      papel: m.papel,
      criadoEm: m.criadoEm,
      usuario: m.usuario,
    }))

    if (q) {
      data = data.filter((m) => m.usuario.nome.toLowerCase().includes(q) || m.usuario.email.toLowerCase().includes(q))
    }
    if (papelFiltro && ['OWNER', 'ADMIN', 'MEMBER'].includes(papelFiltro)) {
      data = data.filter((m) => m.papel === papelFiltro)
    }

    res.json({ data })
  } catch (error) { next(error) }
}

export async function updateMembro(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await carregarEmpresaAutorizada(req, res, PERMISSOES.MEMBERS_EDIT))) return

    const parsed = z.object({ papel: z.enum(['ADMIN', 'MEMBER']) }).safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'Papel inválido. Use ADMIN ou MEMBER.' })
      return
    }

    const alvo = await prisma.membroEmpresa.findFirst({
      where: { id: req.params.memberId, empresaId: req.params.id },
    })
    if (!alvo) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    if (alvo.papel === 'OWNER') {
      res.status(403).json({ error: 'Não é permitido alterar o proprietário' })
      return
    }
    if (req.empresa!.papel === 'ADMIN' && parsed.data.papel === 'ADMIN' && alvo.papel === 'MEMBER') {
      // admin pode promover a admin
    }
    if (req.empresa!.papel !== 'OWNER' && req.empresa!.papel !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso negado para o papel na empresa atual' })
      return
    }

    const atualizado = await prisma.membroEmpresa.update({
      where: { id: alvo.id },
      data: { papel: parsed.data.papel },
      include: { usuario: { select: { id: true, nome: true, email: true, status: true } } },
    })
    res.json(atualizado)
  } catch (error) { next(error) }
}

export async function removeMembro(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await carregarEmpresaAutorizada(req, res, PERMISSOES.MEMBERS_REMOVE))) return

    const alvo = await prisma.membroEmpresa.findFirst({
      where: { id: req.params.memberId, empresaId: req.params.id },
    })
    if (!alvo) {
      res.status(404).json({ error: 'Membro não encontrado' })
      return
    }
    if (alvo.papel === 'OWNER') {
      res.status(403).json({ error: 'Não é permitido remover o proprietário' })
      return
    }
    if (alvo.usuarioId === req.user.id) {
      res.status(403).json({ error: 'Você não pode remover a si mesmo' })
      return
    }

    await prisma.membroEmpresa.delete({ where: { id: alvo.id } })
    res.status(204).end()
  } catch (error) { next(error) }
}

export async function listConvites(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await carregarEmpresaAutorizada(req, res, PERMISSOES.MEMBERS_VIEW))) return

    await marcarConvitesExpirados(req.params.id)

    const convites = await prisma.conviteEmpresa.findMany({
      where: { empresaId: req.params.id, status: { in: ['pendente', 'expirado', 'revogado'] } },
      orderBy: { criadoEm: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        papel: true,
        status: true,
        expiraEm: true,
        aceitoEm: true,
        criadoEm: true,
      },
    })

    const data = convites
      .map((c) => ({ ...c, status: statusConviteDerivado(c) }))
      .filter((c) => c.status === 'pendente' || req.query.todos === '1')

    res.json({ data: data.filter((c) => c.status === 'pendente') })
  } catch (error) { next(error) }
}

export async function criarConvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await carregarEmpresaAutorizada(req, res, PERMISSOES.MEMBERS_INVITE))) return

    const parsed = z.object({
      email: z.string().trim().email().toLowerCase(),
      papel: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    }).safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'Dados do convite inválidos', details: parsed.error.flatten() })
      return
    }
    if (!papeisConvidaveis().includes(parsed.data.papel as PapelEmpresa)) {
      res.status(422).json({ error: 'Papel de convite inválido' })
      return
    }

    const { email, papel } = parsed.data
    await marcarConvitesExpirados(req.params.id)

    const usuarioExistente = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
    if (usuarioExistente) {
      const jaMembro = await prisma.membroEmpresa.findUnique({
        where: { empresaId_usuarioId: { empresaId: req.params.id, usuarioId: usuarioExistente.id } },
      })
      if (jaMembro) {
        res.status(409).json({ error: 'Este usuário já faz parte da empresa.' })
        return
      }
    }

    const pendente = await prisma.conviteEmpresa.findFirst({
      where: { empresaId: req.params.id, email, status: 'pendente', expiraEm: { gt: new Date() } },
      select: { id: true, email: true, papel: true, expiraEm: true, criadoEm: true },
    })
    if (pendente) {
      res.status(409).json({
        error: 'Já existe um convite pendente para este e-mail.',
        conviteId: pendente.id,
        reutilizar: true,
      })
      return
    }

    const token = gerarTokenConvite()
    const convite = await prisma.conviteEmpresa.create({
      data: {
        empresaId: req.params.id,
        email,
        papel,
        tokenHash: hashTokenConvite(token),
        expiraEm: new Date(Date.now() + CONVITE_VALIDADE_MS),
        criadoPorId: req.user.id,
      },
      select: { id: true, email: true, papel: true, expiraEm: true, criadoEm: true, status: true },
    })

    const link = `${frontendBaseUrl()}/convite/${token}`
    res.status(201).json({
      ...convite,
      link,
      expiraEmHoras: 48,
    })
  } catch (error) { next(error) }
}

export async function revogarConvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await carregarEmpresaAutorizada(req, res, PERMISSOES.MEMBERS_INVITE))) return

    const updated = await prisma.conviteEmpresa.updateMany({
      where: { id: req.params.inviteId, empresaId: req.params.id, status: 'pendente' },
      data: { status: 'revogado' },
    })
    if (!updated.count) {
      res.status(404).json({ error: 'Convite não encontrado ou já inválido' })
      return
    }
    res.json({ id: req.params.inviteId, status: 'revogado' })
  } catch (error) { next(error) }
}

/** Recria link a partir de convite pendente existente (novo token). */
export async function reemitirConvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await carregarEmpresaAutorizada(req, res, PERMISSOES.MEMBERS_INVITE))) return

    const atual = await prisma.conviteEmpresa.findFirst({
      where: { id: req.params.inviteId, empresaId: req.params.id, status: 'pendente', expiraEm: { gt: new Date() } },
    })
    if (!atual) {
      res.status(404).json({ error: 'Convite pendente não encontrado' })
      return
    }

    const token = gerarTokenConvite()
    const convite = await prisma.conviteEmpresa.update({
      where: { id: atual.id },
      data: {
        tokenHash: hashTokenConvite(token),
        expiraEm: new Date(Date.now() + CONVITE_VALIDADE_MS),
      },
      select: { id: true, email: true, papel: true, expiraEm: true, criadoEm: true, status: true },
    })

    res.json({
      ...convite,
      link: `${frontendBaseUrl()}/convite/${token}`,
      expiraEmHoras: 48,
    })
  } catch (error) { next(error) }
}

export async function detailEmpresa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    if (!(await carregarEmpresaAutorizada(req, res))) return
    const empresas = await listarEmpresasDoUsuario(req.user.id)
    const atual = empresas.find((e) => e.id === req.params.id)
    if (!atual) {
      res.status(403).json({ error: 'Você não é membro desta empresa' })
      return
    }
    res.json(atual)
  } catch (error) { next(error) }
}

export default {
  listMinhasEmpresas,
  listMembros,
  updateMembro,
  removeMembro,
  listConvites,
  criarConvite,
  revogarConvite,
  reemitirConvite,
  detailEmpresa,
}
