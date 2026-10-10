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
const PERFIS_REVISAO: Perfil[] = ['validador', 'coordenador', 'admin']

/** Revisão humana: perfil de revisão ou OWNER/ADMIN da empresa ativa. */
export function requireRevisor(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Token inválido ou expirado' })
    return
  }
  const papel = req.empresa?.papel
  if (PERFIS_REVISAO.includes(req.user.perfil) || papel === 'OWNER' || papel === 'ADMIN') {
    next()
    return
  }
  res.status(403).json({ error: 'Acesso negado para o perfil atual' })
}

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
