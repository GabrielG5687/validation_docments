import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import prisma from '../config/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { signToken } from '../utils/jwt'

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
  email: z.string().trim().email('E-mail inválido').toLowerCase(),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido').toLowerCase(),
  senha: z.string().min(1, 'Senha é obrigatória'),
})

/**
 * POST /api/auth/cadastro
 * Creates a local user account and returns a JWT session.
 */
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

    const { nome, email, senha } = parseResult.data

    const existing = await prisma.usuario.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'E-mail já cadastrado' })
      return
    }

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash: await hashPassword(senha),
      },
      select: userSelect,
    })

    res.status(201).json({ user: usuario, token: signToken(usuario.id) })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/login
 * Authenticates a registered user and returns a JWT session.
 */
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

    const { senhaHash, ...safeUser } = usuario
    res.status(200).json({ user: safeUser, token: signToken(usuario.id) })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/auth/me
 * Returns the authenticated user from the current JWT.
 */
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

    res.status(200).json({ user: usuario })
  } catch (err) {
    next(err)
  }
}
