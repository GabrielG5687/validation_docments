import { Prisma } from '@prisma/client'
import prisma from '../config/prisma'
import { hashPassword } from '../utils/password'
import { garantirWorkspacePadrao } from './empresaService'

export const DEVELOP_EMAIL = process.env.DEV_USER_EMAIL ?? 'develop@docvalid.local'
export const DEVELOP_PASSWORD = process.env.DEV_USER_PASSWORD ?? 'develop123'
export const DEVELOP_NOME = process.env.DEV_USER_NOME ?? 'Develop'

const MAX_TENTATIVAS = 5
const ESPERA_BASE_MS = 1000

function ehErroConexao(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientInitializationError
}

async function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function criarUsuarioDevelop() {
  const senhaHash = await hashPassword(DEVELOP_PASSWORD)

  const usuario = await prisma.usuario.upsert({
    where: { email: DEVELOP_EMAIL },
    update: {
      nome: DEVELOP_NOME,
      senhaHash,
      perfil: 'admin',
      status: true,
    },
    create: {
      nome: DEVELOP_NOME,
      email: DEVELOP_EMAIL,
      senhaHash,
      perfil: 'admin',
      status: true,
    },
  })

  await garantirWorkspacePadrao(usuario.id, usuario.nome)

  return usuario
}

export async function seedDevelopUser(): Promise<void> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    try {
      await criarUsuarioDevelop()
      console.info(`[Seed] Usuário develop disponível: ${DEVELOP_EMAIL}`)
      return
    } catch (error) {
      if (!ehErroConexao(error) || tentativa === MAX_TENTATIVAS) {
        throw error
      }

      const espera = ESPERA_BASE_MS * 2 ** (tentativa - 1)
      console.warn(
        `[Seed] Banco indisponível (tentativa ${tentativa}/${MAX_TENTATIVAS}); aguardando ${espera}ms`,
      )
      await aguardar(espera)
    }
  }
}
