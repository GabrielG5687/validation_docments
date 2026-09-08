import { Router } from 'express'
import multer from 'multer'
import { requireRole } from '../middlewares/roles'
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  publicarTemplate,
  listVersoes,
  listRegras,
  createRegra,
  testarTemplate,
} from '../controllers/templatesController'
import { analisarTemplateComIa, gerarTemplateComIa } from '../controllers/iaController'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const router = Router()

router.get('/', listTemplates)
router.post('/', requireRole('admin'), createTemplate)
router.post('/gerar-com-ia', requireRole('admin'), upload.single('arquivo'), gerarTemplateComIa)

router.put('/:id', requireRole('admin'), updateTemplate)
router.delete('/:id', requireRole('admin'), deleteTemplate)
router.post('/:id/publicar', requireRole('admin'), publicarTemplate)
router.post('/:id/analisar-ia', requireRole('admin'), upload.single('arquivo'), analisarTemplateComIa)
router.get('/:id/versoes', listVersoes)
router.get('/:id/regras', listRegras)
router.post('/:id/regras', requireRole('admin'), createRegra)
router.post('/:id/testar', upload.single('arquivo'), testarTemplate)
router.get('/:id', getTemplate)

export default router
