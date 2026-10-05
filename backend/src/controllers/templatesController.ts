import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { StatusTemplate, Prisma } from '@prisma/client'
import prisma from '../config/prisma'
import { parseRegraParametros } from '../utils/regraParams'
import { aplicarRegra } from '../services/validationService'
import { extrairTexto } from '../services/pdfService'
import { pdfFromRequest } from '../utils/pdfFile'
import {
  countCampos,
  emptyEstrutura,
  estruturaSchema,
  flattenCampos,
  parseEstrutura,
} from '../utils/estrutura'
import { extrairValoresDeDocumento, onlyFilled } from '../services/extracaoCamposService'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z.nativeEnum(StatusTemplate).optional(),
})

const createTemplateSchema = z.object({
  nome:     z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  categoria: z.string().optional(),
  estrutura: estruturaSchema.optional(),
  validadeDias: z.number().int().min(1).max(3650).optional().nullable(),
})

const updateTemplateSchema = z.object({
  nome:     z.string().min(1).optional(),
  descricao: z.string().optional(),
  categoria: z.string().optional(),
  estrutura: estruturaSchema.optional(),
  validadeDias: z.number().int().min(1).max(3650).optional().nullable(),
})

const testarSchema = z.object({
  valores: z.record(z.string()).optional().default({}),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Increment the major version number.
 * "1.0" → "2.0", "2.0" → "3.0", etc.
 */
function incrementVersion(versao: string): string {
  const major = parseInt(versao.split('.')[0], 10)
  return `${major + 1}.0`
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/templates
 *
 * Lists all templates with optional ?status filter.
 * Accessible by all authenticated profiles.
 *
 * Requirements: 3.1, 3.4, 3.5
 */
export async function listTemplates(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = listQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      res.status(422).json({ error: 'Parâmetros de consulta inválidos', details: parseResult.error.flatten() })
      return
    }

    const { status } = parseResult.data

    const where = status ? { status } : {}

    const data = await prisma.template.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: {
          select: { regras: true, documentos: true, versoes: true },
        },
      },
    })

    res.status(200).json({ data })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/templates/:id
 */
export async function getTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        regras: { orderBy: { ordem: 'asc' } },
        _count: { select: { regras: true, documentos: true, versoes: true } },
      },
    })

    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    res.status(200).json(template)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/templates
 *
 * Creates a new template with status `rascunho` and versaoAtual `1.0`.
 * Protected: admin only.
 *
 * Requirements: 3.1
 */
export async function createTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = createTemplateSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({ error: 'Corpo da requisição inválido', details: parseResult.error.flatten() })
      return
    }

    const { nome, descricao, categoria, estrutura, validadeDias } = parseResult.data

    const template = await prisma.template.create({
      data: {
        nome,
        descricao,
        categoria,
        status: 'rascunho',
        versaoAtual: '1.0',
        validadeDias: validadeDias ?? null,
        estrutura: (estrutura ?? emptyEstrutura()) as Prisma.InputJsonValue,
      },
      include: {
        _count: { select: { regras: true, documentos: true, versoes: true } },
      },
    })

    res.status(201).json(template)
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/templates/:id
 *
 * Updates a template.
 * If the template is currently `ativo`, its status is changed to `rascunho`
 * (changes are staged; the immutable published TemplateVersao snapshot is preserved).
 * Protected: admin only.
 *
 * Requirements: 3.3
 */
export async function updateTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const parseResult = updateTemplateSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({ error: 'Corpo da requisição inválido', details: parseResult.error.flatten() })
      return
    }

    const { nome, descricao, categoria, estrutura, validadeDias } = parseResult.data

    const existing = await prisma.template.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    // If active, stage changes by setting status back to rascunho
    const newStatus: StatusTemplate =
      existing.status === 'ativo' ? 'rascunho' : existing.status

    const updated = await prisma.template.update({
      where: { id },
      data: {
        ...(nome !== undefined      && { nome }),
        ...(descricao !== undefined && { descricao }),
        ...(categoria !== undefined && { categoria }),
        ...(estrutura !== undefined && { estrutura: estrutura as Prisma.InputJsonValue }),
        ...(validadeDias !== undefined && { validadeDias }),
        status: newStatus,
      },
      include: {
        regras: { orderBy: { ordem: 'asc' } },
        _count: { select: { regras: true, documentos: true, versoes: true } },
      },
    })

    res.status(200).json(updated)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/templates/:id
 *
 * Deletes a template. Returns 409 if the template has associated documents.
 * Protected: admin only.
 *
 * Requirements: 3.7
 */
export async function deleteTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const existing = await prisma.template.findUnique({
      where: { id },
      include: { _count: { select: { documentos: true, dossieItens: true } } },
    })

    if (!existing) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    if (existing._count.documentos > 0) {
      res.status(409).json({ error: 'Template possui documentos associados e não pode ser excluído' })
      return
    }

    if (existing._count.dossieItens > 0) {
      res.status(409).json({ error: 'Template está em dossiês e não pode ser excluído' })
      return
    }

    await prisma.template.delete({ where: { id } })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/templates/:id/publicar
 *
 * Publishes a template:
 * - Changes status to `ativo`
 * - Creates a TemplateVersao with a JSON snapshot of the current rules
 * - Increments versaoAtual (major version)
 *
 * Protected: admin only.
 *
 * Requirements: 3.2, 3.5
 */
export async function publicarTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        regras: {
          orderBy: { ordem: 'asc' },
        },
      },
    })

    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    const novaVersao = (await prisma.templateVersao.count({ where: { templateId: id } })) > 0
      ? incrementVersion(template.versaoAtual)
      : template.versaoAtual
    const snapshotRegras = template.regras.map((regra) => ({
      id: regra.id,
      nome: regra.nome,
      tipo: regra.tipo,
      parametros: regra.parametros,
      obrigatoria: regra.obrigatoria,
      ativo: regra.ativo,
      ordem: regra.ordem,
    }))

    // Use a transaction to update template and create version atomically
    const [updatedTemplate, templateVersao] = await prisma.$transaction([
      prisma.template.update({
        where: { id },
        data: {
          status: 'ativo',
          versaoAtual: novaVersao,
        },
      }),
      prisma.templateVersao.create({
        data: {
          templateId: id,
          versao: novaVersao,
          snapshot: {
            regras: snapshotRegras,
            estrutura: template.estrutura,
            nome: template.nome,
            descricao: template.descricao,
            categoria: template.categoria,
            validadeDias: template.validadeDias,
          },
        },
      }),
    ])

    res.status(200).json({
      id:         updatedTemplate.id,
      status:     updatedTemplate.status,
      versaoAtual: updatedTemplate.versaoAtual,
      versao: {
        id:          templateVersao.id,
        versao:      templateVersao.versao,
        publicadoEm: templateVersao.publicadoEm,
        snapshot:    templateVersao.snapshot,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/templates/:id/versoes
 *
 * Lists all TemplateVersao entries for a template with date, version,
 * and the count of rules in the snapshot.
 * Accessible by all authenticated profiles.
 *
 * Requirements: 3.5, 3.6
 */
export async function listVersoes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const template = await prisma.template.findUnique({ where: { id } })
    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    const versoes = await prisma.templateVersao.findMany({
      where: { templateId: id },
      orderBy: { publicadoEm: 'desc' },
    })

    const data = versoes.map((v) => {
      const snap = v.snapshot as { regras?: unknown[]; estrutura?: unknown }
      const numRegras = Array.isArray(snap?.regras) ? snap.regras.length : 0
      return {
        id:          v.id,
        versao:      v.versao,
        publicadoEm: v.publicadoEm,
        numRegras,
        numCampos:   countCampos(snap?.estrutura),
        snapshot:    v.snapshot,
      }
    })

    res.status(200).json({ data })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/templates/:id/regras
 *
 * Lists all validation rules for a template, ordered by `ordem`.
 * Accessible by all authenticated profiles.
 *
 * Requirements: 4.1, 4.8
 */
export async function listRegras(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const template = await prisma.template.findUnique({ where: { id } })
    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    const data = await prisma.regraValidacao.findMany({
      where: { templateId: id },
      orderBy: { ordem: 'asc' },
      select: {
        id:         true,
        nome:       true,
        tipo:       true,
        parametros: true,
        obrigatoria: true,
        ativo:      true,
        ordem:      true,
      },
    })

    res.status(200).json({ data })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/templates/:id/regras
 *
 * Creates a validation rule for the template.
 * Validates required parameters per rule type via Zod.
 * Protected: admin only.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7
 */
export async function createRegra(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id: templateId } = req.params

    const template = await prisma.template.findUnique({ where: { id: templateId } })
    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    // Base schema (fields common to all rule types)
    const baseSchema = z.object({
      nome:       z.string().min(1, 'Nome é obrigatório'),
      tipo:       z.enum(['campo_obrigatorio', 'formato', 'intervalo', 'calculo']),
      obrigatoria: z.boolean().optional().default(true),
      ativo:      z.boolean().optional().default(true),
    })

    const baseResult = baseSchema.safeParse(req.body)
    if (!baseResult.success) {
      res.status(422).json({ error: 'Corpo da requisição inválido', details: baseResult.error.flatten() })
      return
    }

    const { nome, tipo, obrigatoria, ativo } = baseResult.data
    const parsedParams = parseRegraParametros(tipo, req.body.parametros)
    if (!parsedParams.success) {
      res.status(422).json({ error: `Parâmetros inválidos para o tipo ${tipo}`, details: parsedParams.error.flatten() })
      return
    }
    const parametros = parsedParams.data

    // Determine `ordem` as the next available order number
    const maxOrdemResult = await prisma.regraValidacao.aggregate({
      where: { templateId },
      _max: { ordem: true },
    })
    const ordem = (maxOrdemResult._max.ordem ?? 0) + 1

    const regra = await prisma.regraValidacao.create({
      data: {
        templateId,
        nome,
        tipo,
        parametros: parametros as Prisma.InputJsonValue,
        obrigatoria,
        ativo,
        ordem,
      },
      select: {
        id:         true,
        nome:       true,
        tipo:       true,
        parametros: true,
        obrigatoria: true,
        ativo:      true,
        ordem:      true,
      },
    })

    res.status(201).json(regra)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/templates/:id/testar
 *
 * Evaluates current rules against sample values and/or a PDF of example.
 * Does not create a document.
 */
export async function testarTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const template = await prisma.template.findUnique({
      where: { id },
      include: { regras: { orderBy: { ordem: 'asc' } } },
    })
    if (!template) {
      res.status(404).json({ error: 'Template não encontrado' })
      return
    }

    const rawValores = typeof req.body?.valores === 'string'
      ? JSON.parse(req.body.valores || '{}')
      : req.body?.valores
    const parsed = testarSchema.safeParse({ valores: rawValores ?? {} })
    if (!parsed.success) {
      res.status(422).json({ error: 'Valores de teste inválidos', details: parsed.error.flatten() })
      return
    }

    const estrutura = parseEstrutura(template.estrutura)
    const manuais = onlyFilled(parsed.data.valores)
    let extraidos: Record<string, string> = {}
    let resumo: string | undefined
    let alertas: string[] | undefined

    if (req.file) {
      const pdf = pdfFromRequest(req.file)
      if (!pdf.ok) {
        res.status(pdf.status).json({ error: pdf.error })
        return
      }
      const texto = await extrairTexto(pdf.file.buffer)
      const rotulos: Record<string, string> = {}
      const chaves = new Set<string>()
      for (const campo of flattenCampos(estrutura)) {
        chaves.add(campo.identificador)
        if (campo.nome) rotulos[campo.identificador] = campo.nome
      }
      for (const regra of template.regras) {
        const params = regra.parametros as Record<string, unknown>
        if (typeof params.campo === 'string') chaves.add(params.campo)
        if (typeof params.campo_resultado === 'string') chaves.add(params.campo_resultado)
      }
      const extraido = await extrairValoresDeDocumento({
        texto,
        chaves: [...chaves],
        rotulos,
        regras: template.regras.map((regra) => ({
          nome: regra.nome,
          tipo: regra.tipo,
          parametros: regra.parametros,
        })),
      })
      extraidos = extraido.valores
      resumo = extraido.resumo
      alertas = extraido.alertas
    }

    const valores: Record<string, string> = { ...extraidos, ...manuais }

    for (const campo of flattenCampos(estrutura)) {
      if (!valores[campo.identificador] && campo.valorPadrao) {
        valores[campo.identificador] = campo.valorPadrao
      }
    }

    const ativos = template.regras.filter((regra) => regra.ativo)
    const resultados = ativos.map((regra) => {
        const resultado = aplicarRegra(regra, valores)
        return {
          regraId: regra.id,
          nome: regra.nome,
          tipo: regra.tipo,
          status: resultado.status,
          valorEncontrado: resultado.valorEncontrado,
          criterio: resultado.criterio,
        }
      })

    const falhaObrigatoria = ativos.some((regra, index) => regra.obrigatoria && resultados[index].status === 'reprovado')
    const aprovadas = resultados.filter((item) => item.status === 'aprovado').length
    const reprovadas = resultados.length - aprovadas

    res.status(200).json({
      resultado: falhaObrigatoria ? 'reprovado' : 'aprovado',
      aprovadas,
      reprovadas,
      valores,
      resultados,
      resumo,
      alertas,
    })
  } catch (err) {
    if (err instanceof SyntaxError) {
      res.status(422).json({ error: 'Valores de teste inválidos' })
      return
    }
    next(err)
  }
}
