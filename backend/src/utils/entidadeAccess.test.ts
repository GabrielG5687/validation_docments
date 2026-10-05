import { describe, expect, it } from 'vitest'
import { ehGestor, whereEntidadesVisiveis } from './entidadeAccess'

describe('entidadeAccess', () => {
  it('ehGestor reconhece admin e coordenador', () => {
    expect(ehGestor('admin')).toBe(true)
    expect(ehGestor('coordenador')).toBe(true)
    expect(ehGestor('validador')).toBe(false)
    expect(ehGestor('usuario')).toBe(false)
  })

  it('whereEntidadesVisiveis prioriza empresa ativa', () => {
    expect(whereEntidadesVisiveis('admin', 'u1')).toEqual({})
    expect(whereEntidadesVisiveis('admin', 'u1', 'e1')).toEqual({ empresaId: 'e1' })
    expect(whereEntidadesVisiveis('usuario', 'u2', 'e9')).toEqual({ empresaId: 'e9' })
    expect(whereEntidadesVisiveis('usuario', 'u2')).toEqual({ responsavelId: 'u2' })
  })
})
