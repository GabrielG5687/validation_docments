import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000', timeout: 15000 })
api.interceptors.request.use((config) => { const token = useAuthStore().token; if (token) config.headers.Authorization = `Bearer ${token}`; return config })
api.interceptors.response.use((response) => response, async (error) => {
  const requestUrl = String(error.config?.url || '')
  const isAuthRequest = requestUrl.includes('/api/auth/')
  if (error.response?.status === 401 && !isAuthRequest) {
    useAuthStore().logout()
    if (window.location.pathname !== '/login' && window.location.pathname !== '/cadastro') {
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
