import { PapelEmpresa } from '@prisma/client'

/** Permissões granulares — roles são agrupamentos iniciais. */
export const PERMISSOES = {
  MEMBERS_VIEW: 'members.view',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_EDIT: 'members.edit',
  MEMBERS_REMOVE: 'members.remove',
  COMPANY_SETTINGS: 'company.settings',
} as const

export type PermissaoEmpresa = (typeof PERMISSOES)[keyof typeof PERMISSOES]

const PERMISSOES_POR_PAPEL: Record<PapelEmpresa, readonly PermissaoEmpresa[]> = {
  OWNER: [
    PERMISSOES.MEMBERS_VIEW,
    PERMISSOES.MEMBERS_INVITE,
    PERMISSOES.MEMBERS_EDIT,
    PERMISSOES.MEMBERS_REMOVE,
    PERMISSOES.COMPANY_SETTINGS,
  ],
  ADMIN: [
    PERMISSOES.MEMBERS_VIEW,
    PERMISSOES.MEMBERS_INVITE,
    PERMISSOES.MEMBERS_EDIT,
    PERMISSOES.MEMBERS_REMOVE,
  ],
  MEMBER: [],
}

export function permissoesDoPapel(papel: PapelEmpresa): PermissaoEmpresa[] {
  return [...PERMISSOES_POR_PAPEL[papel]]
}

export function temPermissao(papel: PapelEmpresa, permissao: PermissaoEmpresa): boolean {
  return PERMISSOES_POR_PAPEL[papel].includes(permissao)
}

export function papeisConvidaveis(): PapelEmpresa[] {
  return ['ADMIN', 'MEMBER']
}

export function rotuloPapel(papel: PapelEmpresa): string {
  if (papel === 'OWNER') return 'Proprietário'
  if (papel === 'ADMIN') return 'Admin'
  return 'Membro'
}

export default { PERMISSOES, permissoesDoPapel, temPermissao, papeisConvidaveis, rotuloPapel }
