import { Request, Response, NextFunction } from 'express'
import prisma from '../config/prisma'
import { verifyToken } from '../utils/jwt'

/**
 * Autenticação opcional: se houver Bearer válido, preenche req.user;
 * se inválido/ausente, segue sem usuário (não retorna 401).
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    next()
    return
  }

  try {
    const { sub } = verifyToken(authHeader.slice(7))
    const usuario = await prisma.usuario.findUnique({
      where: { id: sub },
      select: { id: true, nome: true, email: true, perfil: true, status: true },
    })
    if (usuario?.status) {
      req.user = usuario
    }
  } catch {
    // token inválido: trata como anônimo
  }
  next()
}

export default optionalAuthenticate
