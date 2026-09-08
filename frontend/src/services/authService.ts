import { api } from './api'
import type { Usuario } from '../types'

export interface AuthResponse {
  user: Usuario
  token: string
}

export const authService = {
  async login(email: string, senha: string) {
    const { data } = await api.post<AuthResponse>('/api/auth/login', { email, senha })
    return data
  },
  async cadastrar(nome: string, email: string, senha: string) {
    const { data } = await api.post<AuthResponse>('/api/auth/cadastro', { nome, email, senha })
    return data
  },
  async me() {
    const { data } = await api.get<{ user: Usuario }>('/api/auth/me')
    return data.user
  },
}
