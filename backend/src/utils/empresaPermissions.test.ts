import { describe, expect, it } from 'vitest'
import { PERMISSOES, temPermissao, papeisConvidaveis } from './empresaPermissions'

describe('empresaPermissions', () => {
  it('OWNER tem todas as permissões de membros e settings', () => {
    expect(temPermissao('OWNER', PERMISSOES.MEMBERS_INVITE)).toBe(true)
    expect(temPermissao('OWNER', PERMISSOES.COMPANY_SETTINGS)).toBe(true)
  })

  it('ADMIN gerencia membros mas não settings', () => {
    expect(temPermissao('ADMIN', PERMISSOES.MEMBERS_REMOVE)).toBe(true)
    expect(temPermissao('ADMIN', PERMISSOES.COMPANY_SETTINGS)).toBe(false)
  })

  it('MEMBER não administra membros', () => {
    expect(temPermissao('MEMBER', PERMISSOES.MEMBERS_VIEW)).toBe(false)
    expect(temPermissao('MEMBER', PERMISSOES.MEMBERS_INVITE)).toBe(false)
  })

  it('não permite convidar OWNER', () => {
    expect(papeisConvidaveis()).toEqual(['ADMIN', 'MEMBER'])
  })
})
