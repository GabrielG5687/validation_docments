import { Router } from 'express'
import { requireRole } from '../middlewares/roles'
import { dashboard, relatorio, relatorioCSV } from '../controllers/relatoriosController'

const router = Router()
router.get('/', requireRole('coordenador', 'admin'), relatorio)
router.get('/exportar', requireRole('coordenador', 'admin'), relatorioCSV)
export default router
