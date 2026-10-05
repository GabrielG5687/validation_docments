import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { signToken } from '../utils/jwt'
import { criarUsuarioComEmpresa, garantirWorkspacePadrao } from '../services/empresaService'

const userSelect = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  status: true,
  criadoEm: true,
} as const

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  nomeEmpresa: z.string().trim().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres').max(200),
  email: z.string().trim().email('E-mail inválido').toLowerCase(),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido').toLowerCase(),
  senha: z.string().min(1, 'Senha é obrigatória'),
})

export async function cadastrar(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = cadastroSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({ error: 'Corpo da requisição inválido', details: parseResult.error.flatten() })
      return
    }

    const { nome, nomeEmpresa, email, senha } = parseResult.data

    const existing = await prisma.usuario.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'E-mail já cadastrado' })
      return
    }

    const { usuarioId, empresaId } = await criarUsuarioComEmpresa({
      nome,
      email,
      senhaHash: await hashPassword(senha),
      nomeEmpresa,
    })

    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: userSelect,
    })
    const empresas = await garantirWorkspacePadrao(usuario.id, usuario.nome)

    res.status(201).json({
      user: usuario,
      token: signToken(usuario.id),
      empresas,
      empresaAtivaId: empresaId,
    })
  } catch (err) {
    next(err)
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = loginSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({ error: 'Corpo da requisição inválido', details: parseResult.error.flatten() })
      return
    }

    const { email, senha } = parseResult.data
    const usuario = await prisma.usuario.findUnique({ where: { email } })

    if (!usuario || !(await verifyPassword(senha, usuario.senhaHash))) {
      res.status(401).json({ error: 'E-mail ou senha inválidos' })
      return
    }

    if (!usuario.status) {
      res.status(403).json({ error: 'Usuário desativado' })
      return
    }

    const { senhaHash: _, ...safeUser } = usuario
    const empresas = await garantirWorkspacePadrao(usuario.id, usuario.nome)

    res.status(200).json({
      user: safeUser,
      token: signToken(usuario.id),
      empresas,
      empresaAtivaId: empresas[0]?.id,
    })
  } catch (err) {
    next(err)
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Token inválido ou expirado' })
      return
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: userSelect,
    })

    if (!usuario) {
      res.status(401).json({ error: 'Token inválido ou expirado' })
      return
    }

    const empresas = await garantirWorkspacePadrao(usuario.id, usuario.nome)
    res.status(200).json({ user: usuario, empresas })
  } catch (err) {
    next(err)
  }
}
