import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { Prisma, StatusDocumento } from '@prisma/client'
import { z } from 'zod'
import prisma from '../config/prisma'
import { sha256 } from '../utils/hash'
import { generateUniqueCode } from '../utils/codeGenerator'
import { gerarQRCode } from '../services/qrcodeService'
import { processarDocumento, changeStatus } from '../services/documentService'
import { validacaoAssinaturaIndisponivel, validarAssinaturasPdf } from '../services/assinatura/signatureValidationService'
import { sincronizarStatusDossiesEntidade } from '../services/dossieService'
import { entidadeAcessivel } from '../utils/entidadeAccess'
import {
  BUCKET_DOCUMENTOS,
  BUCKET_QRCODES,
  deleteFile,
  downloadFile,
  getPresignedUrl,
  uploadFile,
} from '../services/minioService'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const isPdf = (file: Express.Multer.File) =>
  file.mimetype === 'application/pdf' && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'

function fileOrError(req: Request, res: Response): Express.Multer.File | undefined {
  const file = req.file
  if (!file) {
    res.status(422).json({ error: 'Arquivo PDF é obrigatório' })
    return undefined
  }
  if (file.size > MAX_FILE_SIZE) {
    res.status(413).json({ error: 'O arquivo não pode exceder 20 MB' })
    return undefined
  }
  if (!isPdf(file)) {
    res.status(415).json({ error: 'O arquivo enviado não é um PDF válido' })
    return undefined
  }
  return file
}

async function resolverVinculo(req: Request, templateId: string, dossieId?: string): Promise<{ entidadeId?: string; dossieItemId?: string } | null> {
  if (!req.user) return null
  const entidadeIdRaw = typeof req.body?.entidadeId === 'string' ? req.body.entidadeId : undefined
  const dossieItemIdRaw = typeof req.body?.dossieItemId === 'string' ? req.body.dossieItemId : undefined
  if (dossieItemIdRaw) {
    const item = await prisma.dossieItem.findUnique({
      where: { id: dossieItemIdRaw },
      include: { dossie: { select: { entidadeId: true } } },
    })
    if (!item) return null
    if (dossieId && item.dossieId !== dossieId) return null
    if (item.templateId !== templateId) return null
    if (!(await entidadeAcessivel(item.dossie.entidadeId, req.user.perfil, req.user.id, req.empresa?.id))) return null
    return { entidadeId: item.dossie.entidadeId, dossieItemId: item.id }
  }
  if (entidadeIdRaw) {
    if (!(await entidadeAcessivel(entidadeIdRaw, req.user.perfil, req.user.id, req.empresa?.id))) return null
    return { entidadeId: entidadeIdRaw }
  }
  return {}
}

export async function uploadDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  await createDocument(req, res, next)
}

export async function createDocument(req: Request, res: Response, next: NextFunction, origemId?: string): Promise<void> {
  try {
    const file = fileOrError(req, res)
    if (!file || !req.user) return
    const origem = origemId ? await prisma.documento.findUnique({ where: { id: origemId }, select: { templateId: true } }) : null
    const parsed = z.object({ templateId: z.string().uuid().optional(), entidadeId: z.string().uuid().optional(), dossieItemId: z.string().uuid().optional() }).safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'templateId é obrigatório', details: parsed.error.flatten() })
      return
    }
    const templateId = origem?.templateId ?? parsed.data.templateId
    if (!templateId) {
      res.status(422).json({ error: 'templateId é obrigatório' })
      return
    }
    const template = await prisma.template.findUnique({ where: { id: templateId } })
    if (!template || template.status === 'inativo') {
      res.status(404).json({ error: 'Template não encontrado ou inativo' })
      return
    }
    const vinculo = await resolverVinculo(req, templateId)
    if (!vinculo) {
      res.status(422).json({ error: 'Item de dossiê inválido para o template informado ou sem acesso à entidade' })
      return
    }
    if (origemId) {
      const origemCompleta = await prisma.documento.findUnique({ where: { id: origemId } })
      if (!origemCompleta || origemCompleta.usuarioId !== req.user.id || !['reprovado', 'reprovado_automatico'].includes(origemCompleta.status)) {
        res.status(409).json({ error: 'Somente documentos reprovados podem ser reenviados' })
        return
      }
    }
    const hashSha256 = sha256(file.buffer)
    const existing = await prisma.documento.findUnique({
      where: { usuarioId_hashSha256: { usuarioId: req.user.id, hashSha256 } },
      select: { id: true, minioKey: true, status: true, qrcodeKey: true, entidadeId: true, dossieItemId: true },
    })

    if (existing) {
      if (existing.entidadeId && vinculo.entidadeId && existing.entidadeId !== vinculo.entidadeId) {
        res.status(409).json({ error: 'Este arquivo já está vinculado a outra entidade' })
        return
      }
      if (existing.dossieItemId && vinculo.dossieItemId && existing.dossieItemId !== vinculo.dossieItemId) {
        res.status(409).json({ error: 'Este arquivo já está vinculado a outro item de dossiê' })
        return
      }
      const entidadeId = existing.entidadeId ?? vinculo.entidadeId ?? null
      const dossieItemId = existing.dossieItemId ?? vinculo.dossieItemId ?? null
      const minioKey = `${randomUUID()}.pdf`
      await uploadFile(BUCKET_DOCUMENTOS, minioKey, file.buffer, 'application/pdf')
      try {
        await prisma.$transaction(async (tx) => {
          await tx.resultadoRegra.deleteMany({ where: { validacao: { documentoId: existing.id } } })
          await tx.validacao.deleteMany({ where: { documentoId: existing.id } })
          await tx.documento.update({
            where: { id: existing.id },
            data: {
              templateId,
              nomeArquivo: file.originalname,
              minioKey,
              status: 'processando',
              dadosExtraidos: Prisma.DbNull,
              entidadeId,
              dossieItemId,
              dataEmissao: null,
              dataValidade: null,
              statusValidade: null,
              diasParaVencer: null,
              renovacaoNecessaria: false,
              codigoVerificacao: null,
              qrcodeKey: null,
              documentoOrigemId: origemId ?? undefined,
              historico: {
                create: {
                  statusAnterior: existing.status,
                  statusNovo: 'processando',
                  usuarioId: req.user!.id,
                },
              },
            },
          })
        })
      } catch (error) {
        await deleteFile(BUCKET_DOCUMENTOS, minioKey).catch(() => undefined)
        throw error
      }
      await deleteFile(BUCKET_DOCUMENTOS, existing.minioKey).catch(() => undefined)
      if (existing.qrcodeKey) await deleteFile(BUCKET_QRCODES, existing.qrcodeKey).catch(() => undefined)
      const presignedUrl = await getPresignedUrl(BUCKET_DOCUMENTOS, minioKey, 24 * 60 * 60)
      void processarDocumento(existing.id)
      res.status(200).json({ id: existing.id, status: 'processando', nomeArquivo: file.originalname, presignedUrl, reenviado: true })
      return
    }
    const minioKey = `${randomUUID()}.pdf`
    await uploadFile(BUCKET_DOCUMENTOS, minioKey, file.buffer, 'application/pdf')
    try {
      const documento = await prisma.documento.create({
        data: {
          usuarioId: req.user.id,
          templateId,
          nomeArquivo: file.originalname,
          minioKey,
          hashSha256,
          entidadeId: vinculo.entidadeId,
          dossieItemId: vinculo.dossieItemId,
          documentoOrigemId: origemId,
          historico: { create: { statusNovo: 'processando', usuarioId: req.user.id } },
        },
        select: { id: true, status: true, nomeArquivo: true },
      })
      const presignedUrl = await getPresignedUrl(BUCKET_DOCUMENTOS, minioKey, 24 * 60 * 60)
      void processarDocumento(documento.id)
      res.status(201).json({ ...documento, presignedUrl })
    } catch (error) {
      await deleteFile(BUCKET_DOCUMENTOS, minioKey).catch(() => undefined)
      throw error
    }
  } catch (error) {
    next(error)
  }
}

export async function reenviarDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  await createDocument(req, res, next, req.params.id)
}

const listSchema = z.object({
  status: z.nativeEnum(StatusDocumento).optional(),
  templateId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
  validade: z.enum(['vencido', 'proximos', 'todos']).optional(),
})

function validadeFilter(validade?: 'vencido' | 'proximos' | 'todos'): Prisma.DocumentoWhereInput | undefined {
  if (validade === 'vencido') return { statusValidade: 'vencido' }
  if (validade === 'proximos') return { statusValidade: 'proximo_vencimento' }
  if (validade === 'todos') return { dataValidade: { not: null } }
  return undefined
}

export async function listDocumentos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const parsed = listSchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(422).json({ error: 'Parâmetros de consulta inválidos', details: parsed.error.flatten() })
      return
    }
    const { status, templateId, search, dataInicio, dataFim, validade } = parsed.data
    const where: Prisma.DocumentoWhereInput = {
      ...(req.user.perfil === 'usuario' ? { usuarioId: req.user.id } : {}),
      ...(status ? { status } : {}),
      ...(templateId ? { templateId } : {}),
      ...(dataInicio || dataFim ? { criadoEm: { ...(dataInicio ? { gte: dataInicio } : {}), ...(dataFim ? { lte: dataFim } : {}) } } : {}),
      ...(validadeFilter(validade) ?? {}),
      ...(search ? { OR: [{ nomeArquivo: { contains: search, mode: 'insensitive' } }, { usuario: { nome: { contains: search, mode: 'insensitive' } } }] } : {}),
    }
    const data = await prisma.documento.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      include: { usuario: { select: { id: true, nome: true, email: true } }, template: { select: { id: true, nome: true } } },
    })
    res.json({ data })
  } catch (error) { next(error) }
}

export async function detailDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const documento = await prisma.documento.findUnique({
      where: { id: req.params.id },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        template: { select: { id: true, nome: true } },
        validacoes: { include: { validador: { select: { id: true, nome: true } }, resultadosRegra: { include: { regra: { select: { id: true, nome: true, tipo: true } } } } }, orderBy: { criadoEm: 'desc' } },
        historico: { orderBy: { criadoEm: 'asc' } },
      },
    })
    if (!documento) { res.status(404).json({ error: 'Documento não encontrado' }); return }
    if (req.user.perfil === 'usuario' && documento.usuarioId !== req.user.id) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' }); return
    }
    const [presignedUrl, qrcodeUrl] = await Promise.all([
      getPresignedUrl(BUCKET_DOCUMENTOS, documento.minioKey, 24 * 60 * 60),
      documento.qrcodeKey ? getPresignedUrl(BUCKET_QRCODES, documento.qrcodeKey, 24 * 60 * 60) : Promise.resolve(undefined),
    ])
    res.json({ ...documento, presignedUrl, qrcodeUrl })
  } catch (error) { next(error) }
}

export async function listPendentes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.documento.findMany({
      where: { status: 'aguardando_revisao' },
      orderBy: { criadoEm: 'asc' },
      include: { usuario: { select: { id: true, nome: true } }, template: { select: { id: true, nome: true } } },
    })
    res.json({ data })
  } catch (error) { next(error) }
}

export async function iniciarRevisao(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const updated = await prisma.documento.updateMany({ where: { id: req.params.id, status: 'aguardando_revisao' }, data: { status: 'em_revisao' } })
    if (!updated.count) {
      const doc = await prisma.documento.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } })
      if (!doc) { res.status(404).json({ error: 'Documento não encontrado' }); return }
      if (doc.status === 'em_revisao') { res.status(409).json({ error: 'Documento já está sendo revisado por outro validador' }); return }
      res.status(409).json({ error: 'Documento não está disponível para revisão' }); return
    }
    await prisma.historicoStatus.create({ data: { documentoId: req.params.id, statusAnterior: 'aguardando_revisao', statusNovo: 'em_revisao', usuarioId: req.user.id } })
    res.json({ id: req.params.id, status: 'em_revisao' })
  } catch (error) { next(error) }
}

export async function finalizarRevisao(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const parsed = z.object({ resultado: z.enum(['aprovado', 'reprovado']), observacoes: z.string().optional() }).safeParse(req.body)
    if (!parsed.success) { res.status(422).json({ error: 'Resultado inválido', details: parsed.error.flatten() }); return }
    const { resultado, observacoes } = parsed.data
    if (resultado === 'reprovado' && (!observacoes || observacoes.trim().length < 10)) {
      res.status(422).json({ error: 'Informe o motivo da reprovação (mínimo 10 caracteres)' }); return
    }
    const documento = await prisma.documento.findUnique({ where: { id: req.params.id } })
    if (!documento) { res.status(404).json({ error: 'Documento não encontrado' }); return }
    if (documento.status !== 'em_revisao') { res.status(409).json({ error: 'Documento não está em revisão' }); return }
    let codigoVerificacao: string | undefined
    let qrcodeKey: string | undefined
    if (resultado === 'aprovado') {
      codigoVerificacao = await generateUniqueCode(prisma)
      qrcodeKey = `${randomUUID()}.png`
      const qr = await gerarQRCode(codigoVerificacao, process.env.BASE_URL ?? 'http://localhost:3000')
      await uploadFile(BUCKET_QRCODES, qrcodeKey, qr, 'image/png')
    }
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.documento.updateMany({
          where: { id: documento.id, status: 'em_revisao' },
          data: { status: resultado, codigoVerificacao, qrcodeKey },
        })
        if (!claimed.count) {
          throw Object.assign(new Error('Documento não está em revisão'), { status: 409 })
        }
        await tx.validacao.create({ data: { documentoId: documento.id, validadorId: req.user!.id, resultado, observacoes } })
        await tx.historicoStatus.create({ data: { documentoId: documento.id, statusAnterior: 'em_revisao', statusNovo: resultado, usuarioId: req.user!.id } })
        if (resultado === 'aprovado' && documento.dossieItemId) {
          await tx.dossieItem.updateMany({ where: { id: documento.dossieItemId }, data: { documentoId: documento.id } })
        }
      })
    } catch (error) {
      if (qrcodeKey) await deleteFile(BUCKET_QRCODES, qrcodeKey).catch(() => undefined)
      throw error
    }
    if (resultado === 'aprovado' && documento.entidadeId) {
      await sincronizarStatusDossiesEntidade(documento.entidadeId)
    }
    const qrcodeUrl = qrcodeKey ? await getPresignedUrl(BUCKET_QRCODES, qrcodeKey, 24 * 60 * 60) : undefined
    res.json({ id: documento.id, status: resultado, ...(codigoVerificacao ? { codigoVerificacao, qrcodeUrl } : {}) })
  } catch (error) { next(error) }
}

export async function validarAssinaturaDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const documento = await prisma.documento.findUnique({ where: { id: req.params.id } })
    if (!documento) {
      res.status(404).json({ error: 'Documento não encontrado' })
      return
    }
    if (req.user.perfil === 'usuario' && documento.usuarioId !== req.user.id) {
      res.status(403).json({ error: 'Acesso negado para o perfil atual' })
      return
    }
    const buffer = await downloadFile(BUCKET_DOCUMENTOS, documento.minioKey)
    let resultado
    try {
      resultado = await validarAssinaturasPdf(buffer)
    } catch (error) {
      resultado = validacaoAssinaturaIndisponivel(
        error instanceof Error ? error.message : 'Falha na validação criptográfica da assinatura'
      )
    }
    const atuais = (documento.dadosExtraidos && typeof documento.dadosExtraidos === 'object' && !Array.isArray(documento.dadosExtraidos))
      ? documento.dadosExtraidos as Record<string, unknown>
      : {}
    await prisma.documento.update({
      where: { id: documento.id },
      data: { dadosExtraidos: { ...atuais, _assinaturaGov: resultado } as unknown as Prisma.InputJsonValue },
    })
    res.json(resultado)
  } catch (error) { next(error) }
}

export async function cancelarRevisao(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return
    const updated = await prisma.documento.updateMany({ where: { id: req.params.id, status: 'em_revisao' }, data: { status: 'aguardando_revisao' } })
    if (!updated.count) { res.status(409).json({ error: 'Documento não está em revisão' }); return }
    await prisma.historicoStatus.create({ data: { documentoId: req.params.id, statusAnterior: 'em_revisao', statusNovo: 'aguardando_revisao', usuarioId: req.user.id } })
    res.json({ id: req.params.id, status: 'aguardando_revisao' })
  } catch (error) { next(error) }
}
