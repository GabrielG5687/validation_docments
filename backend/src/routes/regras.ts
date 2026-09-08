import { Router } from 'express'
import {
  reordenarRegras,
  updateRegra,
  deleteRegra,
} from '../controllers/regrasController'

const router = Router()

/**
 * All routes in this file assume that `authenticate` and `requireRole('admin')`
 * have already been applied by app.ts before this router is mounted.
 *
 * PUT /api/regras/reordenar must be declared BEFORE PUT /api/regras/:id
 * so Express matches the literal "reordenar" path first.
 */

/** PUT /api/regras/reordenar — bulk update rule order */
router.put('/reordenar', reordenarRegras)

/** PUT /api/regras/:id — update a single rule */
router.put('/:id', updateRegra)

/** DELETE /api/regras/:id — delete a rule */
router.delete('/:id', deleteRegra)

export default router
