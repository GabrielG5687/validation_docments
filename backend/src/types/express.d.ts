import { PapelEmpresa, Perfil } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        nome: string
        email: string
        perfil: Perfil
        status: boolean
      }
      empresa?: {
        id: string
        nome: string
        papel: PapelEmpresa
        membroId: string
        permissoes: string[]
      }
    }
  }
}

export {}
