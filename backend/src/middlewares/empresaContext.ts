import { Request, Response, NextFunction } from 'express'
import { garantirWorkspacePadrao, obterMembro } from '../services/empresaService'
import { permissoesDoPapel, temPermissao, type PermissaoEmpresa } from '../utils/empresaPermissions'

/**
 * Resolve a empresa ativa (header X-Empresa-Id ou primeira membership).
 * Deve rodar após authenticate.
 */
export async function resolveEmpresaContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      next()
      return
    }

    const header = req.header('x-empresa-id')?.trim()
    if (header) {
      const membro = await obterMembro(header, req.user.id)
      if (!membro) {
        res.status(403).json({ error: 'Você não é membro desta empresa' })
        return
      }
      req.empresa = {
        id: membro.empresa.id,
        nome: membro.empresa.nome,
        papel: membro.papel,
        membroId: membro.id,
        permissoes: permissoesDoPapel(membro.papel),
      }
      next()
      return
    }

    const empresas = await garantirWorkspacePadrao(req.user.id, req.user.nome)
    const primeira = empresas[0]
    if (primeira) {
      req.empresa = {
        id: primeira.id,
        nome: primeira.nome,
        papel: primeira.papel,
        membroId: '',
        permissoes: primeira.permissoes,
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function requireEmpresa(req: Request, res: Response, next: NextFunction): void {
  if (!req.empresa) {
    res.status(400).json({ error: 'Nenhuma empresa disponível no contexto atual' })
    return
  }
  next()
}

export function requireEmpresaPermissao(...permissoes: PermissaoEmpresa[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.empresa) {
      res.status(400).json({ error: 'Nenhuma empresa disponível no contexto atual' })
      return
    }
    const ok = permissoes.some((p) => temPermissao(req.empresa!.papel, p))
    if (!ok) {
      res.status(403).json({ error: 'Acesso negado para o papel na empresa atual' })
      return
    }
    next()
  }
}

export default { resolveEmpresaContext, requireEmpresa, requireEmpresaPermissao }
