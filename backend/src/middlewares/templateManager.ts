import { Request, Response, NextFunction } from 'express'
import { podeGerenciarTemplates } from '../utils/templateAccess'

/**
 * Autoriza criação/edição de templates.
 *
 * Ao contrário de `requireRole`, que olha apenas o perfil global, aqui o
 * proprietário da empresa também pode gerenciar os templates da própria empresa.
 * Exige `resolveEmpresaContext` antes (montado em app.ts antes deste router).
 */
export function requireTemplateManager(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Token inválido ou expirado' })
    return
  }

  if (!podeGerenciarTemplates(req.user.perfil, req.empresa?.papel)) {
    res.status(403).json({ error: 'Apenas administradores ou o proprietário da empresa podem gerenciar templates' })
    return
  }

  next()
}

export default requireTemplateManager
