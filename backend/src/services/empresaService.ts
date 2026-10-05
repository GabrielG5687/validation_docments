import { PapelEmpresa, Prisma } from '@prisma/client'
import prisma from '../config/prisma'
import { permissoesDoPapel } from '../utils/empresaPermissions'

export type EmpresaResumo = {
  id: string
  nome: string
  papel: PapelEmpresa
  permissoes: string[]
  criadoEm: Date
}

export async function listarEmpresasDoUsuario(usuarioId: string): Promise<EmpresaResumo[]> {
  const membros = await prisma.membroEmpresa.findMany({
    where: { usuarioId },
    orderBy: { criadoEm: 'asc' },
    include: { empresa: { select: { id: true, nome: true, criadoEm: true } } },
  })
  return membros.map((m) => ({
    id: m.empresa.id,
    nome: m.empresa.nome,
    papel: m.papel,
    permissoes: permissoesDoPapel(m.papel),
    criadoEm: m.empresa.criadoEm,
  }))
}

export async function obterMembro(empresaId: string, usuarioId: string) {
  return prisma.membroEmpresa.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId } },
    include: { empresa: { select: { id: true, nome: true } } },
  })
}

export async function criarUsuarioComEmpresa(params: {
  nome: string
  email: string
  senhaHash: string
  nomeEmpresa: string
}): Promise<{ usuarioId: string; empresaId: string }> {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        nome: params.nome,
        email: params.email,
        senhaHash: params.senhaHash,
      },
      select: { id: true },
    })
    const empresa = await tx.empresa.create({
      data: { nome: params.nomeEmpresa },
      select: { id: true },
    })
    await tx.membroEmpresa.create({
      data: {
        empresaId: empresa.id,
        usuarioId: usuario.id,
        papel: 'OWNER',
      },
    })
    return { usuarioId: usuario.id, empresaId: empresa.id }
  })
}

/** Usuários legados sem membership ganham um workspace OWNER. */
export async function garantirWorkspacePadrao(usuarioId: string, nomeUsuario: string): Promise<EmpresaResumo[]> {
  let empresas = await listarEmpresasDoUsuario(usuarioId)
  if (empresas.length) return empresas

  const nome = `${nomeUsuario.trim() || 'Workspace'} — Workspace`
  await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({ data: { nome }, select: { id: true } })
    await tx.membroEmpresa.create({
      data: { empresaId: empresa.id, usuarioId, papel: 'OWNER' },
    })
    await tx.entidade.updateMany({
      where: { responsavelId: usuarioId, empresaId: null },
      data: { empresaId: empresa.id },
    })
  })
  empresas = await listarEmpresasDoUsuario(usuarioId)
  return empresas
}

export function statusConviteDerivado(convite: {
  status: string
  expiraEm: Date
  aceitoEm: Date | null
}): 'pendente' | 'aceito' | 'expirado' | 'revogado' {
  if (convite.status === 'aceito' || convite.aceitoEm) return 'aceito'
  if (convite.status === 'revogado') return 'revogado'
  if (convite.status === 'expirado' || convite.expiraEm.getTime() <= Date.now()) return 'expirado'
  return 'pendente'
}

export async function marcarConvitesExpirados(empresaId?: string): Promise<void> {
  await prisma.conviteEmpresa.updateMany({
    where: {
      status: 'pendente',
      expiraEm: { lte: new Date() },
      ...(empresaId ? { empresaId } : {}),
    },
    data: { status: 'expirado' },
  })
}

export type Tx = Prisma.TransactionClient

export default {
  listarEmpresasDoUsuario,
  obterMembro,
  criarUsuarioComEmpresa,
  statusConviteDerivado,
  marcarConvitesExpirados,
}
