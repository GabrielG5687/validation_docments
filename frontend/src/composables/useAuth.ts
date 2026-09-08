import { useAuthStore } from '../stores/auth'
import { authService } from '../services/authService'
import axios from 'axios'

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
    if (error.response?.status === 401) return 'E-mail ou senha inválidos.'
  }
  return fallback
}

export function useAuth() {
  const store = useAuthStore()

  async function loginComEmail(email: string, senha: string) {
    try {
      const response = await authService.login(email, senha)
      return store.setSession(response.user, response.token)
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'E-mail ou senha inválidos.'))
    }
  }

  async function cadastrar(nome: string, email: string, senha: string) {
    try {
      const response = await authService.cadastrar(nome, email, senha)
      return store.setSession(response.user, response.token)
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Não foi possível concluir o cadastro.'))
    }
  }

  function logout() {
    store.logout()
  }

  return { loginComEmail, cadastrar, logout }
}
