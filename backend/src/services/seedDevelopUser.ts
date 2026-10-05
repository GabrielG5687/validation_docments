import prisma from '../config/prisma'
import { hashPassword } from '../utils/password'
import { garantirWorkspacePadrao } from './empresaService'

export const DEVELOP_EMAIL = process.env.DEV_USER_EMAIL ?? 'develop@docvalid.local'
export const DEVELOP_PASSWORD = process.env.DEV_USER_PASSWORD ?? 'develop123'
export const DEVELOP_NOME = process.env.DEV_USER_NOME ?? 'Develop'

export async function seedDevelopUser(): Promise<void> {
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
  console.info(`[Seed] Usuário develop disponível: ${DEVELOP_EMAIL}`)
}
