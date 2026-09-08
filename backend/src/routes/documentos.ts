import { Router } from 'express'
import multer from 'multer'
import { requireRole } from '../middlewares/roles'
import {
  uploadDocumento, reenviarDocumento, listDocumentos, detailDocumento,
  listPendentes, iniciarRevisao, finalizarRevisao, cancelarRevisao,
} from '../controllers/documentosController'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const router = Router()

router.post('/upload', requireRole('usuario', 'admin'), upload.single('arquivo'), uploadDocumento)
router.get('/pendentes', requireRole('validador', 'coordenador', 'admin'), listPendentes)
router.get('/', listDocumentos)
router.get('/:id', detailDocumento)
router.post('/:id/reenviar', requireRole('usuario', 'admin'), upload.single('arquivo'), reenviarDocumento)
router.post('/:id/revisao/iniciar', requireRole('validador', 'coordenador', 'admin'), iniciarRevisao)
router.post('/:id/revisao/finalizar', requireRole('validador', 'coordenador', 'admin'), finalizarRevisao)
router.post('/:id/revisao/cancelar', requireRole('validador', 'coordenador', 'admin'), cancelarRevisao)

export default router
