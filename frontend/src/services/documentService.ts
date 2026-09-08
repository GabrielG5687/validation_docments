import { api } from './api'
import type { Documento } from '../types'
export const documentService = {
  async list(params?: Record<string, string>) { const { data } = await api.get<{ data: Documento[]; total?: number }>('/api/documentos', { params }); return data },
  async pending() { const { data } = await api.get<{ data: Documento[] }>('/api/documentos/pendentes'); return data },
  async get(id: string) { const { data } = await api.get<Documento>(`/api/documentos/${id}`); return data },
  async upload(file: File, templateId: string, onUploadProgress?: (progress: number) => void) { const form = new FormData(); form.append('templateId', templateId); form.append('arquivo', file); const { data } = await api.post<Documento & { presignedUrl?: string }>('/api/documentos/upload', form, { onUploadProgress: (event) => onUploadProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0) }); return data },
  async startReview(id: string) { const { data } = await api.post<Documento>(`/api/documentos/${id}/revisao/iniciar`); return data },
  async finishReview(id: string, resultado: 'aprovado' | 'reprovado', observacoes: string) { const { data } = await api.post<Documento>(`/api/documentos/${id}/revisao/finalizar`, { resultado, observacoes }); return data },
  async cancelReview(id: string) { return api.post(`/api/documentos/${id}/revisao/cancelar`) },
}
