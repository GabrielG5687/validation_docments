import { Router } from 'express'
import multer from 'multer'
import { publicRateLimiter } from '../middlewares/rateLimiter'
import { verificarDocumento, verificarIntegridade } from '../controllers/verificarController'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
router.use(publicRateLimiter)
router.get('/:codigo', verificarDocumento)
router.post('/:codigo/integridade', upload.single('arquivo'), verificarIntegridade)

export default router
