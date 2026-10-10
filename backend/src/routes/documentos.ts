import { Router } from 'express'
import multer from 'multer'
import { requireRevisor, requireRole } from '../middlewares/roles'
import {
  uploadDocumento, reenviarDocumento, listDocumentos, detailDocumento,
  listPendentes, iniciarRevisao, finalizarRevisao, cancelarRevisao,
  validarAssinaturaDocumento,
} from '../controllers/documentosController'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const router = Router()

router.post('/upload', requireRole('usuario', 'admin'), upload.single('arquivo'), uploadDocumento)
router.get('/pendentes', requireRevisor, listPendentes)
router.get('/', listDocumentos)
router.get('/:id', detailDocumento)
router.post('/:id/validar-assinatura', validarAssinaturaDocumento)
router.post('/:id/reenviar', requireRole('usuario', 'admin'), upload.single('arquivo'), reenviarDocumento)
router.post('/:id/revisao/iniciar', requireRevisor, iniciarRevisao)
router.post('/:id/revisao/finalizar', requireRevisor, finalizarRevisao)
router.post('/:id/revisao/cancelar', requireRevisor, cancelarRevisao)

export default router
