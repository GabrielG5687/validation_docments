import { onUnmounted } from 'vue'
import { documentService } from '../services/documentService'
import type { Documento } from '../types'
export function useDocument() { let timer: number | undefined; async function poll(id: string, onUpdate: (doc: Documento) => void) { const tick = async () => { const doc = await documentService.get(id); onUpdate(doc); if (!['processando', 'aguardando_validacao'].includes(doc.status)) { if (timer) window.clearInterval(timer) } }; await tick(); timer = window.setInterval(tick, 5000) }; onUnmounted(() => { if (timer) window.clearInterval(timer) }); return { poll } }
