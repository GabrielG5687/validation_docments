import { Request, Response, NextFunction } from 'express'
import { Perfil } from '@prisma/client'

/**
 * Role-based authorization middleware factory.
 *
 * Returns a middleware that allows access only if the authenticated user's
 * perfil is one of the supplied perfis.
 *
 * Requirements: 2.5, 2.6
 */
export function requireRole(...perfis: Perfil[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Should not happen when authenticate runs first, but guard anyway
      res.status(401).json({ error: 'Token inválido ou expirado' })
      return
    }

    if (!perfis.includes(req.user.perfil)) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' })
      return
    }

    next()
  }
}

export default requireRole
