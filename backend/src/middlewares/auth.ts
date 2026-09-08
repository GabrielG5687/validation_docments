import { Request, Response, NextFunction } from 'express'
import prisma from '../config/prisma'
import { verifyToken } from '../utils/jwt'

/**
 * Authentication middleware.
 *
 * - Extracts Bearer token from the Authorization header.
 * - Verifies the JWT and loads the corresponding Usuario.
 * - Returns 401 for missing/invalid/expired tokens.
 * - Returns 403 for deactivated users (status: false).
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token inválido ou expirado' })
    return
  }

  const token = authHeader.slice(7)

  try {
    const { sub } = verifyToken(token)

    const usuario = await prisma.usuario.findUnique({
      where: { id: sub },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        status: true,
      },
    })

    if (!usuario) {
      res.status(401).json({ error: 'Token inválido ou expirado' })
      return
    }

    if (!usuario.status) {
      res.status(403).json({ error: 'Usuário desativado' })
      return
    }

    req.user = usuario
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

export default authenticate
