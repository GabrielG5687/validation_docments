import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Perfil } from '@prisma/client'
import prisma from '../config/prisma'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
})

const updateUsuarioSchema = z
  .object({
    perfil: z.nativeEnum(Perfil).optional(),
    status: z.boolean().optional(),
  })
  .refine((data) => data.perfil !== undefined || data.status !== undefined, {
    message: 'Pelo menos um campo (perfil ou status) deve ser informado',
  })

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/usuarios
 *
 * Returns a paginated list of all users.
 * Supports ?page, ?limit and ?search (case-insensitive match on nome and email).
 *
 * Protected: admin only (enforced by route middleware).
 *
 * Requirements: 2.1, 2.2, 2.6
 */
export async function listUsuarios(
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

    const { page, limit, search } = parseResult.data
    const skip = (page - 1) * limit

    // Build optional search filter
    const where = search
      ? {
          OR: [
            { nome:  { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [data, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        select: {
          id:       true,
          nome:     true,
          email:    true,
          perfil:   true,
          status:   true,
          criadoEm: true,
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limit,
      }),
      prisma.usuario.count({ where }),
    ])

    res.status(200).json({ data, total, page, limit })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/usuarios/:id
 *
 * Updates perfil and/or status of a user.
 * Protected: admin only (enforced by route middleware).
 *
 * Requirements: 2.3, 2.4, 2.6
 */
export async function updateUsuario(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params

    const parseResult = updateUsuarioSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({ error: 'Corpo da requisição inválido', details: parseResult.error.flatten() })
      return
    }

    const { perfil, status } = parseResult.data

    // Check the user exists before attempting to update
    const existing = await prisma.usuario.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Usuário não encontrado' })
      return
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: {
        ...(perfil !== undefined && { perfil }),
        ...(status !== undefined && { status }),
      },
      select: {
        id:     true,
        perfil: true,
        status: true,
      },
    })

    res.status(200).json(updated)
  } catch (err) {
    next(err)
  }
}
