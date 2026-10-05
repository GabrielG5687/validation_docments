import { Router } from 'express'
import {
  listMinhasEmpresas,
  detailEmpresa,
  listMembros,
  updateMembro,
  removeMembro,
  listConvites,
  criarConvite,
  revogarConvite,
  reemitirConvite,
} from '../controllers/empresasController'

const router = Router()

router.get('/', listMinhasEmpresas)
router.get('/:id', detailEmpresa)
router.get('/:id/membros', listMembros)
router.patch('/:id/membros/:memberId', updateMembro)
router.delete('/:id/membros/:memberId', removeMembro)
router.get('/:id/convites', listConvites)
router.post('/:id/convites', criarConvite)
router.post('/:id/convites/:inviteId/reemitir', reemitirConvite)
router.post('/:id/convites/:inviteId/revogar', revogarConvite)

export default router
