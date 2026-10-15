import { describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { requireNonOwnerWorkspaceAccess, requireWorkspaceAccess } from './empresaContext'

function run(papel?: 'OWNER' | 'ADMIN' | 'MEMBER') {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const next = vi.fn()
  const req = { empresa: papel ? { papel } : undefined } as Request
  const res = { status } as unknown as Response

  requireWorkspaceAccess(req, res, next as NextFunction)
  return { json, status, next }
}

describe('requireWorkspaceAccess', () => {
  it('blocks normal company members from non-document workspaces', () => {
    const result = run('MEMBER')

    expect(result.status).toHaveBeenCalledWith(403)
    expect(result.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('documentos') }))
    expect(result.next).not.toHaveBeenCalled()
  })

  it.each(['OWNER', 'ADMIN', undefined] as const)('allows %s to continue', (papel) => {
    const result = run(papel)

    expect(result.next).toHaveBeenCalledOnce()
    expect(result.status).not.toHaveBeenCalled()
  })
})

describe('requireNonOwnerWorkspaceAccess', () => {
  it('blocks owners from modules outside their workspace scope', () => {
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const next = vi.fn()

    requireNonOwnerWorkspaceAccess(
      { empresa: { papel: 'OWNER' } } as Request,
      { status } as unknown as Response,
      next as NextFunction,
    )

    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('proprietários') }))
    expect(next).not.toHaveBeenCalled()
  })
})
