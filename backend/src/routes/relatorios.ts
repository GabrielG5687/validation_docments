import { Router, Request, Response, NextFunction } from 'express'
import { relatorio, relatorioCSV } from '../controllers/relatoriosController'

const router = Router()

function requireRelatorio(req: Request, res: Response, next: NextFunction): void {
  const perfil = req.user?.perfil
  const papel = req.empresa?.papel
  if (perfil === 'coordenador' || perfil === 'admin' || papel === 'OWNER' || papel === 'ADMIN') {
    next()
    return
  }
  res.status(403).json({ error: 'Relatórios disponíveis para proprietários e admins da organização.' })
}

router.get('/', requireRelatorio, relatorio)
router.get('/exportar', requireRelatorio, relatorioCSV)
export default router
