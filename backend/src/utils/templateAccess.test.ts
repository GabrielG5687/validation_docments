import { describe, expect, it } from 'vitest'
import {
  podeGerenciarTemplates,
  whereTemplateDaEmpresa,
  whereTemplatesVisiveis,
} from './templateAccess'

describe('templateAccess', () => {
  it('whereTemplatesVisiveis restringe à empresa ativa', () => {
    expect(whereTemplatesVisiveis('e1')).toEqual({ empresaId: 'e1' })
  })

  it('whereTemplatesVisiveis fecha a lista sem empresa ativa', () => {
    const filtro = whereTemplatesVisiveis(undefined)
    expect(filtro.empresaId).toBeUndefined()
    // condição sentinela: jamais casa com um id real
    expect(filtro.id).toBeTruthy()
    expect(whereTemplatesVisiveis()).toEqual(filtro)
  })

  it('whereTemplateDaEmpresa combina id e empresa', () => {
    expect(whereTemplateDaEmpresa('t1', 'e1')).toEqual({ id: 't1', empresaId: 'e1' })
  })

  it('whereTemplateDaEmpresa nega acesso sem empresa ativa', () => {
    const filtro = whereTemplateDaEmpresa('t1', undefined)
    expect(filtro.empresaId).toBeUndefined()
    expect(filtro.id).not.toBe('t1')
  })

  it('podeGerenciarTemplates permite admin global e OWNER', () => {
    expect(podeGerenciarTemplates('admin')).toBe(true)
    expect(podeGerenciarTemplates('admin', 'MEMBER')).toBe(true)
    expect(podeGerenciarTemplates('coordenador', 'OWNER')).toBe(true)
    expect(podeGerenciarTemplates('usuario', 'OWNER')).toBe(true)
    expect(podeGerenciarTemplates('validador', 'OWNER')).toBe(true)
  })

  it('podeGerenciarTemplates nega ADMIN e MEMBER da empresa', () => {
    expect(podeGerenciarTemplates('coordenador', 'ADMIN')).toBe(false)
    expect(podeGerenciarTemplates('validador', 'MEMBER')).toBe(false)
    expect(podeGerenciarTemplates('usuario', 'MEMBER')).toBe(false)
    expect(podeGerenciarTemplates('coordenador')).toBe(false)
  })
})
