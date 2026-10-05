import { Router } from 'express'
import { listNotificacoes, marcarLida, marcarTodasLidas } from '../controllers/notificacoesController'

const router = Router()

router.get('/', listNotificacoes)
router.post('/ler-todas', marcarTodasLidas)
router.post('/:id/lida', marcarLida)

export default router