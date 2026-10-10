import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../config/prisma'
import { regraDaEmpresa } from '../utils/templateAccess'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const reordenarSchema = z.object({
  ordens: z
    .array(
      z.object({
        id:    z.string().uuid('id deve ser um UUID válido'),
        ordem: z.number().int().positive('ordem deve ser um inteiro positivo'),
      })
    )
    .min(1, 'ordens não pode ser vazio'),
})

// ─── Parametros validation helpers ───────────────────────────────────────────

/**
 * Validates `parametros` according to the rule's `tipo`.
 * Returns the parsed parametros or throws a validation error response.
 */
function validateParametros(
  tipo: string,
  rawParametros: unknown
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string; details: unknown } {
  if (tipo === 'campo_obrigatorio') {
    const schema = z.object({ campo: z.string().min(1, 'campo é obrigatório') })
    const result = schema.safeParse(rawParametros)
    if (!result.success) {
      return { ok: false, error: 'Parâmetros inválidos para o tipo campo_obrigatorio', details: result.error.flatten() }
    }
    return { ok: true, data: result.data }
  }

  if (tipo === 'formato') {
    const schema = z.object({
      campo: z.string().min(1, 'campo é obrigatório'),
      regex: z.string().min(1, 'regex é obrigatório'),
    })
    const result = schema.safeParse(rawParametros)
    if (!result.success) {
      return { ok: false, error: 'Parâmetros inválidos para o tipo formato', details: result.error.flatten() }
    }
    return { ok: true, data: result.data }
  }

  if (tipo === 'intervalo') {
    const schema = z.object({
      campo: z.string().min(1, 'campo é obrigatório'),
      min:   z.number({ required_error: 'min é obrigatório' }),
      max:   z.number({ required_error: 'max é obrigatório' }),
    })
    const result = schema.safeParse(rawParametros)
    if (!result.success) {
      return { ok: false, error: 'Parâmetros inválidos para o tipo intervalo', details: result.error.flatten() }
    }
    return { ok: true, data: result.data }
  }

  if (tipo === 'calculo') {
    const schema = z.object({
      expressao:      z.string().min(1, 'expressao é obrigatória'),
      campo_resultado: z.string().min(1, 'campo_resultado é obrigatório'),
      tolerancia:     z.number({ required_error: 'tolerancia é obrigatória' }),
    })
    const result = schema.safeParse(rawParametros)
    if (!result.success) {
      return { ok: false, error: 'Parâmetros inválidos para o tipo calculo', details: result.error.flatten() }
    }
    return { ok: true, data: result.data }
  }

  return { ok: false, error: `Tipo de regra desconhecido: ${tipo}`, details: null }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * PUT /api/regras/:id
 *
 * Updates an existing validation rule of a template in the active company.
 * Protected: requireTemplateManager.
 *
 * Requirements: 4.6
 */
export async function updateRegra(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const existing = await regraDaEmpresa(id, req.empresa?.id)
    if (!existing) {
      res.status(404).json({ error: 'Regra não encontrada' })
      return
    }

    // Build update schema: all fields optional, but if `tipo` changes,
    // `parametros` must be re-validated against the new type.
    const updateSchema = z.object({
      nome:       z.string().min(1).optional(),
      tipo:       z.enum(['campo_obrigatorio', 'formato', 'intervalo', 'calculo']).optional(),
      parametros: z.record(z.unknown()).optional(),
      obrigatoria: z.boolean().optional(),
      ativo:      z.boolean().optional(),
      ordem:      z.number().int().positive().optional(),
    })

    const parseResult = updateSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({ error: 'Corpo da requisição inválido', details: parseResult.error.flatten() })
      return
    }

    const { nome, tipo, parametros, obrigatoria, ativo, ordem } = parseResult.data

    // If parametros are provided (or tipo changed), validate them
    let validatedParametros: Record<string, unknown> | undefined
    const effectiveTipo = tipo ?? existing.tipo
    if (parametros !== undefined || tipo !== undefined) {
      const effectiveParametros = parametros ?? existing.parametros
      const validation = validateParametros(effectiveTipo, effectiveParametros)
      if (!validation.ok) {
        res.status(422).json({ error: validation.error, details: validation.details })
        return
      }
      validatedParametros = validation.data
    }

    const updated = await prisma.regraValidacao.update({
      where: { id },
      data: {
        ...(nome !== undefined        && { nome }),
        ...(tipo !== undefined        && { tipo }),
        ...(validatedParametros       && { parametros: validatedParametros as Prisma.InputJsonValue }),
        ...(obrigatoria !== undefined && { obrigatoria }),
        ...(ativo !== undefined       && { ativo }),
        ...(ordem !== undefined       && { ordem }),
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

    res.status(200).json(updated)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/regras/:id
 *
 * Deletes a validation rule of a template in the active company.
 * Protected: requireTemplateManager.
 *
 * Requirements: 4.6
 */
export async function deleteRegra(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const existing = await regraDaEmpresa(id, req.empresa?.id)
    if (!existing) {
      res.status(404).json({ error: 'Regra não encontrada' })
      return
    }

    await prisma.regraValidacao.delete({ where: { id } })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/regras/reordenar
 *
 * Bulk-updates the `ordem` field for multiple rules of a template in the
 * active company.
 * Protected: requireTemplateManager.
 *
 * Request body: { ordens: [{ id: "uuid", ordem: 1 }, ...] }
 * Response: { updated: N }
 *
 * Requirements: 4.6
 */
export async function reordenarRegras(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = reordenarSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({ error: 'Corpo da requisição inválido', details: parseResult.error.flatten() })
      return
    }

    const { ordens } = parseResult.data
    const ids = ordens.map((item) => item.id)
    const values = ordens.map((item) => item.ordem)
    if (new Set(ids).size !== ids.length || new Set(values).size !== values.length) {
      res.status(422).json({ error: 'As regras e ordens não podem se repetir' })
      return
    }
    const existing = await prisma.regraValidacao.findMany({
      where: { id: { in: ids }, template: { empresaId: req.empresa?.id } },
      select: { id: true, templateId: true },
    })
    if (existing.length !== ids.length) {
      res.status(404).json({ error: 'Uma ou mais regras não encontradas nesta empresa' })
      return
    }
    if (new Set(existing.map((item) => item.templateId)).size > 1) {
      res.status(422).json({ error: 'As regras devem pertencer ao mesmo template' })
      return
    }

    // Run all updates inside a transaction
    await prisma.$transaction(
      ordens.map(({ id, ordem }) =>
        prisma.regraValidacao.update({
          where: { id },
          data: { ordem },
        })
      )
    )

    res.status(200).json({ updated: ordens.length })
  } catch (err) {
    next(err)
  }
}
