import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'
import { hashPassword } from '../utils/password'
import { signToken } from '../utils/jwt'
import { hashTokenConvite } from '../utils/inviteToken'
import { statusConviteDerivado } from '../services/empresaService'
import { rotuloPapel } from '../utils/empresaPermissions'

const userSelect = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  status: true,
  criadoEm: true,
} as const

const cadastroAceiteSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmarSenha: z.string().min(8, 'Confirmação de senha inválida'),
  email: z.string().trim().email().toLowerCase().optional(),
})

async function carregarConvitePorToken(token: string) {
  if (!token || token.length < 32) return null
  return prisma.conviteEmpresa.findUnique({
    where: { tokenHash: hashTokenConvite(token) },
    include: { empresa: { select: { id: true, nome: true } } },
  })
}

async function reverterClaimConvite(conviteId: string): Promise<void> {
  await prisma.conviteEmpresa.updateMany({
    where: { id: conviteId, status: 'aceito', aceitoEm: { not: null } },
    data: { status: 'pendente', aceitoEm: null },
  }).catch(() => undefined)
}

export async function previewConvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const convite = await carregarConvitePorToken(req.params.token)
    if (!convite) {
      res.status(404).json({ error: 'Convite não encontrado' })
      return
    }

    const status = statusConviteDerivado(convite)
    if (status === 'expirado' && convite.status === 'pendente') {
      await prisma.conviteEmpresa.update({ where: { id: convite.id }, data: { status: 'expirado' } })
    }

    if (status === 'aceito') {
      res.status(410).json({ error: 'Este convite já foi utilizado.', status: 'aceito' })
      return
    }
    if (status === 'revogado') {
      res.status(410).json({ error: 'Este convite foi revogado.', status: 'revogado' })
      return
    }
    if (status === 'expirado') {
      res.status(410).json({ error: 'Este convite expirou.', status: 'expirado' })
      return
    }

    const conta = await prisma.usuario.findUnique({ where: { email: convite.email }, select: { id: true } })
    res.json({
      email: convite.email,
      papel: convite.papel,
      papelRotulo: rotuloPapel(convite.papel),
      status: 'pendente',
      expiraEm: convite.expiraEm,
      empresa: convite.empresa,
      contaExiste: Boolean(conta),
    })
  } catch (error) { next(error) }
}

export async function aceitarConvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const convite = await carregarConvitePorToken(req.params.token)
    if (!convite) {
      res.status(404).json({ error: 'Convite não encontrado' })
      return
    }

    const status = statusConviteDerivado(convite)
    if (status === 'aceito') {
      res.status(410).json({ error: 'Este convite já foi utilizado.' })
      return
    }
    if (status === 'revogado') {
      res.status(410).json({ error: 'Este convite foi revogado.' })
      return
    }
    if (status === 'expirado') {
      await prisma.conviteEmpresa.updateMany({
        where: { id: convite.id, status: 'pendente' },
        data: { status: 'expirado' },
      })
      res.status(410).json({ error: 'Este convite expirou.' })
      return
    }

    let usuarioId = req.user?.id
    let usuarioCriado = false
    let cadastro: { nome: string; senhaHash: string } | null = null

    if (usuarioId && req.user) {
      if (req.user.email.toLowerCase() !== convite.email.toLowerCase()) {
        res.status(403).json({
          error: 'Este convite foi enviado para outro e-mail. Saia da conta atual para aceitar.',
        })
        return
      }
    } else {
      const existing = await prisma.usuario.findUnique({
        where: { email: convite.email },
        select: { id: true },
      })
      if (existing) {
        res.status(401).json({
          error: 'Já existe uma conta com este e-mail. Faça login para aceitar o convite.',
          requerLogin: true,
          email: convite.email,
        })
        return
      }

      const parsed = cadastroAceiteSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors
        const first = Object.values(fieldErrors).flat()[0]
        res.status(422).json({
          error: first || 'Dados de cadastro inválidos. Informe nome (mín. 2) e senha (mín. 8).',
          details: parsed.error.flatten(),
        })
        return
      }
      if (parsed.data.senha !== parsed.data.confirmarSenha) {
        res.status(422).json({ error: 'As senhas não coincidem' })
        return
      }
      if (parsed.data.email && parsed.data.email !== convite.email.toLowerCase()) {
        res.status(422).json({ error: 'O e-mail deve ser o mesmo do convite.' })
        return
      }
      cadastro = {
        nome: parsed.data.nome,
        senhaHash: await hashPassword(parsed.data.senha),
      }
    }

    const papelFinal = convite.papel === 'OWNER' ? 'MEMBER' : convite.papel

    // Claim atômico sem interactive transaction (compatível com Neon pooler)
    const claimed = await prisma.conviteEmpresa.updateMany({
      where: {
        id: convite.id,
        status: 'pendente',
        expiraEm: { gt: new Date() },
      },
      data: { status: 'aceito', aceitoEm: new Date() },
    })
    if (!claimed.count) {
      res.status(410).json({ error: 'Este convite já foi utilizado ou expirou.' })
      return
    }

    try {
      let usuario = usuarioId
        ? await prisma.usuario.findUnique({ where: { id: usuarioId }, select: userSelect })
        : null

      if (!usuario && cadastro) {
        usuario = await prisma.usuario.create({
          data: {
            nome: cadastro.nome,
            email: convite.email.toLowerCase(),
            senhaHash: cadastro.senhaHash,
          },
          select: userSelect,
        })
        usuarioId = usuario.id
        usuarioCriado = true
      }

      if (!usuarioId || !usuario) {
        await reverterClaimConvite(convite.id)
        res.status(401).json({ error: 'Autenticação necessária para aceitar o convite' })
        return
      }

      const jaMembro = await prisma.membroEmpresa.findUnique({
        where: { empresaId_usuarioId: { empresaId: convite.empresaId, usuarioId } },
      })
      const membro = jaMembro ?? await prisma.membroEmpresa.create({
        data: {
          empresaId: convite.empresaId,
          usuarioId,
          papel: papelFinal,
        },
      })

      res.status(usuarioCriado ? 201 : 200).json({
        membro,
        empresa: convite.empresa,
        user: usuario,
        token: signToken(usuario.id),
      })
    } catch (error) {
      if (usuarioCriado && usuarioId) {
        await prisma.membroEmpresa.deleteMany({ where: { usuarioId, empresaId: convite.empresaId } }).catch(() => undefined)
        await prisma.usuario.delete({ where: { id: usuarioId } }).catch(() => undefined)
      }
      await reverterClaimConvite(convite.id)
      throw error
    }
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 410 || status === 401) {
      res.status(status).json({ error: (error as Error).message })
      return
    }
    next(error)
  }
}

export default { previewConvite, aceitarConvite }
