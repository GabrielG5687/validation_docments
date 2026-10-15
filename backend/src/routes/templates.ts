import { Router } from 'express'
import multer from 'multer'
import { requireTemplateManager } from '../middlewares/templateManager'
import { requireWorkspaceAccess } from '../middlewares/empresaContext'
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
import { analisarTemplateComIa, gerarRegexComIa, gerarTemplateComIa } from '../controllers/iaController'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const router = Router()

/**
 * Leitura: visível a qualquer perfil autenticado, mas apenas os templates da
 * empresa ativa. Escrita: exige admin global ou proprietário da empresa.
 */
router.get('/', listTemplates)
router.use(requireWorkspaceAccess)
router.post('/', requireTemplateManager, createTemplate)
router.post('/gerar-com-ia', requireTemplateManager, upload.single('arquivo'), gerarTemplateComIa)
router.post('/gerar-regex', requireTemplateManager, gerarRegexComIa)

router.put('/:id', requireTemplateManager, updateTemplate)
router.delete('/:id', requireTemplateManager, deleteTemplate)
router.post('/:id/publicar', requireTemplateManager, publicarTemplate)
router.post('/:id/analisar-ia', requireTemplateManager, upload.single('arquivo'), analisarTemplateComIa)
router.get('/:id/versoes', listVersoes)
router.get('/:id/regras', listRegras)
router.post('/:id/regras', requireTemplateManager, createRegra)
router.post('/:id/testar', upload.single('arquivo'), testarTemplate)
router.get('/:id', getTemplate)

export default router
