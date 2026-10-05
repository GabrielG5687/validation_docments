import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean
    skipEmpresa?: boolean
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (!config.skipAuth && auth.token) config.headers.Authorization = `Bearer ${auth.token}`
  if (!config.skipEmpresa) {
    const empresaId = auth.empresaAtivaId || auth.empresaAtiva?.id
    if (empresaId) config.headers['X-Empresa-Id'] = empresaId
  }
  return config
})

api.interceptors.response.use((response) => response, async (error) => {
  const requestUrl = String(error.config?.url || '')
  const isAuthRequest = requestUrl.includes('/api/auth/')
  const isConvitePublic = requestUrl.includes('/api/convites/')
  if (error.response?.status === 401 && !isAuthRequest && !isConvitePublic) {
    useAuthStore().logout()
    if (window.location.pathname !== '/login' && window.location.pathname !== '/cadastro' && !window.location.pathname.startsWith('/convite/')) {
      const { default: router } = await import('../router')
      await router.push({ path: '/login', query: { redirect: window.location.pathname } })
    }
  } else if (error.response?.status === 403) {
    const message = (error.response.data as { error?: string } | undefined)?.error || 'Acesso negado para o perfil atual.'
    useNotificationStore().push({ type: 'error', message })
  } else if (error.response?.status === 502 || error.response?.status === 503) {
    const message = (error.response.data as { error?: string } | undefined)?.error || 'Serviço indisponível.'
    useNotificationStore().push({ type: 'error', message })
  } else if (error.response?.status >= 500) {
    useNotificationStore().push({ type: 'error', message: 'Ocorreu um erro no servidor. Tente novamente em instantes.' })
  }
  return Promise.reject(error)
})
