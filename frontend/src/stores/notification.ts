import { defineStore } from 'pinia'
import { ref } from 'vue'
export type ToastType = 'success' | 'error' | 'warning' | 'info'
export const useNotificationStore = defineStore('notification', () => {
  const toasts = ref<Array<{ id: number; type: ToastType; message: string }>>([])
  function push(toast: { type: ToastType; message: string }) { const id = Date.now() + Math.random(); toasts.value.push({ ...toast, id }); window.setTimeout(() => dismiss(id), 5000) }
  function dismiss(id: number) { toasts.value = toasts.value.filter((toast) => toast.id !== id) }
  return { toasts, push, dismiss }
})
