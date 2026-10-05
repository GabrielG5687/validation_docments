import type { Prisma } from '@prisma/client'
import prisma from '../config/prisma'

export type CriarNotificacaoInput = {
  destinatarioId: string
  tipo: string
  titulo: string
  mensagem: string
  documentoId?: string
  dossieId?: string
  entidadeId?: string
}

export function criarNotificacao(input: CriarNotificacaoInput): Prisma.PrismaPromise<{ id: string }> {
  return prisma.notificacao.create({
    data: input,
    select: { id: true },
  })
}

export async function notificarVencimentoDocumento(documentoId: string): Promise<void> {
  const documento = await prisma.documento.findUnique({
    where: { id: documentoId },
    select: {
      id: true,
      usuarioId: true,
      nomeArquivo: true,
      entidade: { select: { id: true, nome: true } },
    },
  })
  if (!documento) return
  await criarNotificacao({
    destinatarioId: documento.usuarioId,
    tipo: 'renovacao',
    titulo: 'Renovação necessária',
    mensagem: `O documento ${documento.nomeArquivo} da entidade ${documento.entidade?.nome ?? 'não vinculada'} venceu. Solicite um novo documento.`,
    documentoId: documento.id,
    entidadeId: documento.entidade?.id,
  })
}

export default { criarNotificacao, notificarVencimentoDocumento }