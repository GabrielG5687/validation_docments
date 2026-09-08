import { onMounted, onUnmounted, ref } from 'vue'
import { api } from '../services/api'
export function useConnection() {
  const isOnline = ref(navigator.onLine)
  const check = async () => { try { await api.get('/api/health', { timeout: 5000 }); isOnline.value = true } catch { isOnline.value = false } }
  onMounted(() => { window.addEventListener('online', check); window.addEventListener('offline', () => { isOnline.value = false }); check() })
  onUnmounted(() => { window.removeEventListener('online', check) })
  return { isOnline, check }
}
