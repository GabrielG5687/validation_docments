import { onMounted, onUnmounted } from 'vue'
export function useDashboardPolling(refresh: () => void) { let timer: number | undefined; onMounted(() => { timer = window.setInterval(refresh, 60000) }); onUnmounted(() => { if (timer) window.clearInterval(timer) }) }
