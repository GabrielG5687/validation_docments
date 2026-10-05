import { Router } from 'express'
import multer from 'multer'
import { requireRole } from '../middlewares/roles'
import {
  listDossies,
  createDossie,
  detailDossie,
  checklistDossie,
  updateDossie,
  deleteDossie,
  adicionarItem,
  removerItem,
  requisitarDocumentos,
  uploadParametrizado,
} from '../controllers/dossiesController'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const router = Router()

router.get('/', listDossies)
router.post('/', createDossie)
router.delete('/itens/:itemId', removerItem)
router.get('/:id', detailDossie)
router.put('/:id', updateDossie)
router.delete('/:id', deleteDossie)
router.get('/:id/checklist', checklistDossie)
router.post('/:id/itens', adicionarItem)
router.post('/:id/requisitar', requisitarDocumentos)
router.post('/:id/documento', requireRole('usuario', 'admin'), upload.single('arquivo'), uploadParametrizado)

export default router