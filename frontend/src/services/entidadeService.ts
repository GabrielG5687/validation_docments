import { api } from './api'
import type { ConformidadeEntidade, Dossie, Entidade, Notificacao, TipoEntidade } from '../types'

export const entidadeService = {
  async list() { const { data } = await api.get<{ data: Entidade[] }>('/api/entidades'); return data.data },
  async get(id: string) { const { data } = await api.get<Entidade>(`/api/entidades/${id}`); return data },
  async create(payload: { tipo: TipoEntidade; nome: string; documentoIdentificador?: string; cnpjOuCpf?: string }) { const { data } = await api.post<Entidade>('/api/entidades', payload); return data },
  async update(id: string, payload: Partial<Pick<Entidade, 'tipo' | 'nome' | 'documentoIdentificador' | 'cnpjOuCpf'>>) { const { data } = await api.put<Entidade>(`/api/entidades/${id}`, payload); return data },
  async remove(id: string) { return api.delete(`/api/entidades/${id}`) },
  async conformidade(id: string) { const { data } = await api.get<ConformidadeEntidade>(`/api/entidades/${id}/conformidade`); return data },
  async vencendo(id: string, dias = 30) { const { data } = await api.get<{ data: Array<{ id: string; nomeArquivo: string; dataValidade: string | null; statusValidade: string | null; diasParaVencer: number; template: { id: string; nome: string } }> }>(`/api/entidades/${id}/vencendo`, { params: { dias } }); return data.data },

  async listDossies(entidadeId?: string) { const { data } = await api.get<{ data: Dossie[] }>('/api/dossies', { params: entidadeId ? { entidadeId } : undefined }); return data.data },
  async getDossie(id: string) { const { data } = await api.get<Dossie>(`/api/dossies/${id}`); return data },
  async createDossie(payload: { entidadeId: string; nome: string; descricao?: string; itens: Array<{ templateId: string; obrigatorio: boolean }> }) { const { data } = await api.post<Dossie>('/api/dossies', payload); return data },
  async updateDossie(id: string, payload: { nome?: string; descricao?: string }) { const { data } = await api.put<Dossie>(`/api/dossies/${id}`, payload); return data },
  async removeDossie(id: string) { return api.delete(`/api/dossies/${id}`) },
  async addItem(dossieId: string, payload: { templateId: string; obrigatorio: boolean }) { const { data } = await api.post<Dossie>(`/api/dossies/${dossieId}/itens`, payload); return data },
  async removeItem(itemId: string) { return api.delete(`/api/dossies/itens/${itemId}`) },
  async requisitar(dossieId: string, dossieItemId?: string) { const { data } = await api.post<{ solicitados: number }>(`/api/dossies/${dossieId}/requisitar`, dossieItemId ? { dossieItemId } : {}); return data },
  async uploadDocumento(dossieId: string, dossieItemId: string, file: File, onUploadProgress?: (progress: number) => void) {
    const form = new FormData()
    form.append('dossieItemId', dossieItemId)
    form.append('arquivo', file)
    const { data } = await api.post<{ id: string; status: string; nomeArquivo: string }>(`/api/dossies/${dossieId}/documento`, form, { onUploadProgress: (event) => onUploadProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0) })
    return data
  },

  async notificacoes() { const { data } = await api.get<{ data: Notificacao[]; naoLidas: number }>('/api/notificacoes'); return data },
  async marcarLida(id: string) { const { data } = await api.post<{ id: string; lida: boolean }>(`/api/notificacoes/${id}/lida`); return data },
  async marcarTodasLidas() { const { data } = await api.post<{ atualizadas: number }>('/api/notificacoes/ler-todas'); return data },
}

export default entidadeService