import { Request, Response, NextFunction } from 'express'
import { Prisma, RegraValidacao } from '@prisma/client'
import prisma from '../config/prisma'
import { extrairTexto } from '../services/pdfService'
import {
  GroqConfigError,
  analisarTemplateComIa as analisarComGroq,
  gerarRegexComIa as gerarRegexComGroq,
  gerarTemplateComIa as gerarComGroq,
  isGroqConfigured,
} from '../services/groqService'
import { pdfFromRequest } from '../utils/pdfFile'
import { buildEstruturaFromRegras } from '../utils/estrutura'
import { buscarTemplateDaEmpresa } from '../utils/templateAccess'

function groqOrFail(res: Response): boolean {
  if (isGroqConfigured()) return true
  res.status(503).json({ error: 'IA não configurada. Defina GROQ_API_KEY no .env do backend.' })
  return false
}

function handleIaError(err: unknown, next: NextFunction, res: Response): void {
  if (err instanceof GroqConfigError) {
    res.status(503).json({ error: err.message })
    return
  }
  if (err instanceof Error) {
    res.status(502).json({ error: err.message || 'Falha ao consultar a IA' })
    return
  }
  next(err)
}

/**
 * POST /api/templates/gerar-com-ia
 * Gerenciador de templates: envia um PDF de exemplo e cria um template rascunho
 * pertencente à empresa ativa, com regras sugeridas.
 */
export async function gerarTemplateComIa(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.empresa) {
      res.status(400).json({ error: 'Nenhuma empresa ativa definida' })
      return
    }
    if (!groqOrFail(res)) return
    const pdf = pdfFromRequest(req.file)
    if (!pdf.ok) {
      res.status(pdf.status).json({ error: pdf.error })
      return
    }

    const nome = typeof req.body?.nome === 'string' ? req.body.nome : undefined
    const texto = await extrairTexto(pdf.file.buffer)
    if (!texto.trim()) {
      res.status(422).json({ error: 'Não foi possível extrair texto deste PDF' })
      return
    }

    const gerado = await gerarComGroq(texto, nome)
    const empresaId = req.empresa.id

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          nome: gerado.nome,
          descricao: gerado.descricao || 'Template gerado com IA a partir de um documento de exemplo.',
          status: 'rascunho',
          versaoAtual: '1.0',
          empresaId,
          estrutura: buildEstruturaFromRegras(gerado.regras) as Prisma.InputJsonValue,
          regras: {
            create: gerado.regras.map((regra, index) => ({
              nome: regra.nome,
              tipo: regra.tipo,
              parametros: regra.parametros as Prisma.InputJsonValue,
              obrigatoria: regra.obrigatoria,
              ativo: true,
              ordem: index + 1,
            })),
          },
        },
        include: {
          regras: { orderBy: { ordem: 'asc' } },
          _count: { select: { regras: true, documentos: true, versoes: true } },
        },
      })
      return created
    })

    res.status(201).json(template)
  } catch (err) {
    handleIaError(err, next, res)
  }
}

/**
 * POST /api/templates/gerar-regex
 * Recebe a descrição do formato e devolve uma regex validada.
 */
export async function gerarRegexComIa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!groqOrFail(res)) return
    const descricao = typeof req.body?.descricao === 'string' ? req.body.descricao : ''
    const gerado = await gerarRegexComGroq(descricao)
    res.status(200).json(gerado)
  } catch (err) {
    handleIaError(err, next, res)
  }
}

/**
 * POST /api/templates/:id/analisar-ia
 * Gerenciador de templates: analisa as regras atuais de um template da empresa
 * ativa e, se um PDF for enviado, compara com o documento.
 */
export async function analisarTemplateComIa(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!groqOrFail(res)) return
    const template = await buscarTemplateDaEmpresa<{ regras: RegraValidacao[] }>(
      req.params.id,
      req.empresa?.id,
      { regras: { orderBy: { ordem: 'asc' } } },
    )
    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    let textoDocumento: string | undefined
    if (req.file) {
      const pdf = pdfFromRequest(req.file)
      if (!pdf.ok) {
        res.status(pdf.status).json({ error: pdf.error })
        return
      }
      textoDocumento = await extrairTexto(pdf.file.buffer)
    }

    const analise = await analisarComGroq(
      template.regras.map((regra) => ({
        nome: regra.nome,
        tipo: regra.tipo,
        parametros: regra.parametros,
        obrigatoria: regra.obrigatoria,
      })),
      textoDocumento
    )

    res.status(200).json(analise)
  } catch (err) {
    handleIaError(err, next, res)
  }
}
