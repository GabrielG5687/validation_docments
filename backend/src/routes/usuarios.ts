import { Router } from 'express'
import { listUsuarios, updateUsuario } from '../controllers/usuariosController'

const router = Router()

/**
 * All routes in this file assume that authenticate + requireRole('admin')
 * have already been applied by app.ts before this router is mounted.
 */

/** GET /api/usuarios — paginated list with optional search */
router.get('/', listUsuarios)

/** PUT /api/usuarios/:id — update perfil and/or status */
router.put('/:id', updateUsuario)

export default router
