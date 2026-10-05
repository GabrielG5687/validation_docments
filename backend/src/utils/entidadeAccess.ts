import prisma from '../config/prisma'

export function ehGestor(perfil: string): boolean {
  return perfil === 'admin' || perfil === 'coordenador'
}

/**
 * Leitura com isolamento por empresa.
 * Quando há empresa ativa (já autorizada no middleware), basta a entidade pertencer a ela.
 */
export async function entidadeAcessivel(
  entidadeId: string,
  perfil: string,
  usuarioId: string,
  empresaId?: string,
): Promise<boolean> {
  const entidade = await prisma.entidade.findUnique({
    where: { id: entidadeId },
    select: { responsavelId: true, empresaId: true },
  })
  if (!entidade) return false

  if (empresaId) {
    if (entidade.empresaId === empresaId) return true
    // legado sem empresaId: mantém regra antiga
    if (!entidade.empresaId) {
      if (ehGestor(perfil)) return true
      return entidade.responsavelId === usuarioId
    }
    return false
  }

  if (ehGestor(perfil)) return true
  return entidade.responsavelId === usuarioId
}

export async function podeGerenciarEntidade(
  entidadeId: string,
  perfil: string,
  usuarioId: string,
  empresaId?: string,
): Promise<boolean> {
  return entidadeAcessivel(entidadeId, perfil, usuarioId, empresaId)
}

/** Filtro de listagem: prioriza isolamento por empresa ativa. */
export function whereEntidadesVisiveis(
  perfil: string,
  usuarioId: string,
  empresaId?: string,
): { responsavelId?: string; empresaId?: string } {
  if (empresaId) return { empresaId }
  if (!ehGestor(perfil)) return { responsavelId: usuarioId }
  return {}
}

export default { ehGestor, entidadeAcessivel, podeGerenciarEntidade, whereEntidadesVisiveis }
