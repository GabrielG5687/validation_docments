import { Router } from 'express'
import { requireRole } from '../middlewares/roles'
import {
  listEntidades,
  createEntidade,
  detailEntidade,
  updateEntidade,
  deleteEntidade,
  conformidadeEntidade,
  vencendoEntidade,
} from '../controllers/entidadesController'

const router = Router()

router.get('/', listEntidades)
router.post('/', requireRole('usuario', 'admin', 'coordenador'), createEntidade)
router.get('/:id', detailEntidade)
router.put('/:id', updateEntidade)
router.delete('/:id', deleteEntidade)
router.get('/:id/conformidade', conformidadeEntidade)
router.get('/:id/vencendo', vencendoEntidade)

export default router
