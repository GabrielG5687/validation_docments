import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Documento } from '../types'
import { documentService } from '../services/documentService'
export const useDocumentStore = defineStore('document', () => {
  const documentos = ref<Documento[]>([]); const documentoAtual = ref<Documento | null>(null); const loading = ref(false); const error = ref('')
  async function list(params?: Record<string, string>) { loading.value = true; error.value = ''; try { const result = await documentService.list(params); documentos.value = result.data; return result } catch (e) { error.value = 'Não foi possível carregar os documentos.'; throw e } finally { loading.value = false } }
  async function get(id: string) { loading.value = true; try { documentoAtual.value = await documentService.get(id); return documentoAtual.value } finally { loading.value = false } }
  async function upload(file: File, templateId: string, onProgress?: (value: number) => void) { return documentService.upload(file, templateId, onProgress) }
  return { documentos, documentoAtual, loading, error, list, get, upload }
})
