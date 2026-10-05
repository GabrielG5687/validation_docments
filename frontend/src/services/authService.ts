import { api } from './api'
import type { EmpresaResumo, Usuario } from '../types'

export interface AuthResponse {
  user: Usuario
  token: string
  empresas?: EmpresaResumo[]
  empresaAtivaId?: string
}

export const authService = {
  async login(email: string, senha: string) {
    const { data } = await api.post<AuthResponse>('/api/auth/login', { email, senha })
    return data
  },
  async cadastrar(nome: string, email: string, senha: string, nomeEmpresa: string) {
    const { data } = await api.post<AuthResponse>('/api/auth/cadastro', { nome, email, senha, nomeEmpresa })
    return data
  },
  async me() {
    const { data } = await api.get<{ user: Usuario; empresas: EmpresaResumo[] }>('/api/auth/me')
    return data
  },
}
