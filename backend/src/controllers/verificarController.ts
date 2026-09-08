import { Request, Response, NextFunction } from 'express'
import prisma from '../config/prisma'
import { sha256 } from '../utils/hash'

export async function verificarDocumento(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const codigo = req.params.codigo.toUpperCase()
    const documento = await prisma.documento.findUnique({
      where: { codigoVerificacao: codigo },
      include: {
        template: { select: { nome: true } },
        validacoes: { where: { resultado: 'aprovado' }, orderBy: { criadoEm: 'desc' }, take: 1, include: { validador: { select: { nome: true } } } },
      },
    })
    if (!documento) { res.status(404).json({ error: 'Código de verificação não encontrado' }); return }
    const validacao = documento.validacoes[0]
    res.json({
      valido: documento.status === 'aprovado',
      codigoVerificacao: documento.codigoVerificacao,
      template: documento.template.nome,
      dataAprovacao: validacao?.criadoEm ?? null,
      nomeValidador: validacao?.validador.nome ?? null,
      dataEnvio: documento.criadoEm,
      status: documento.status,
    })
  } catch (error) { next(error) }
}

export async function verificarIntegridade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file
    if (!file) { res.status(422).json({ error: 'Arquivo PDF é obrigatório' }); return }
    if (file.mimetype !== 'application/pdf' || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      res.status(415).json({ error: 'O arquivo enviado não é um PDF válido' }); return
    }
    const documento = await prisma.documento.findUnique({ where: { codigoVerificacao: req.params.codigo.toUpperCase() }, select: { hashSha256: true } })
    if (!documento) { res.status(404).json({ error: 'Código de verificação não encontrado' }); return }
    const hashEnviado = sha256(file.buffer)
    res.json({ integro: hashEnviado === documento.hashSha256, hashEnviado, hashOriginal: documento.hashSha256 })
  } catch (error) { next(error) }
}
