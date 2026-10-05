import { Router } from 'express'
import { previewConvite, aceitarConvite } from '../controllers/convitesController'
import { optionalAuthenticate } from '../middlewares/optionalAuth'

const router = Router()

router.get('/:token', previewConvite)
router.post('/:token/aceitar', optionalAuthenticate, aceitarConvite)

export default router
