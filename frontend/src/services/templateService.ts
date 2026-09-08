import { api } from './api'
import type { AnaliseIa, EstruturaTemplate, RegraValidacao, Template, TemplateVersao, TesteTemplateResultado } from '../types'

const iaTimeout = { timeout: 90_000 }

export const templateService = {
  async list(status?: string) {
    const { data } = await api.get<{ data: Template[] }>('/api/templates', { params: status ? { status } : {} })
    return data.data
  },
  async get(id: string) {
    const { data } = await api.get<Template>(`/api/templates/${id}`)
    return data
  },
  async create(payload: Pick<Template, 'nome' | 'descricao'> & { categoria?: string; estrutura?: EstruturaTemplate }) {
    const { data } = await api.post<Template>('/api/templates', payload)
    return data
  },
  async generateWithAi(file: File, nome?: string) {
    const form = new FormData()
    form.append('arquivo', file)
    if (nome) form.append('nome', nome)
    const { data } = await api.post<Template>('/api/templates/gerar-com-ia', form, iaTimeout)
    return data
  },
  async analyzeWithAi(id: string, file?: File) {
    const form = new FormData()
    if (file) form.append('arquivo', file)
    const { data } = await api.post<AnaliseIa>(`/api/templates/${id}/analisar-ia`, form, iaTimeout)
    return data
  },
  async update(id: string, payload: Partial<Pick<Template, 'nome' | 'descricao' | 'categoria' | 'estrutura'>>) {
    const { data } = await api.put<Template>(`/api/templates/${id}`, payload)
    return data
  },
  async remove(id: string) {
    return api.delete(`/api/templates/${id}`)
  },
  async publish(id: string) {
    const { data } = await api.post(`/api/templates/${id}/publicar`)
    return data
  },
  async versions(id: string) {
    const { data } = await api.get<{ data: TemplateVersao[] }>(`/api/templates/${id}/versoes`)
    return data.data
  },
  async test(id: string, payload: { valores?: Record<string, string>; file?: File }) {
    const filled = Object.fromEntries(
      Object.entries(payload.valores ?? {}).filter(([, value]) => String(value || '').trim())
    )
    if (payload.file) {
      const form = new FormData()
      form.append('valores', JSON.stringify(filled))
      form.append('arquivo', payload.file)
      const { data } = await api.post<TesteTemplateResultado>(`/api/templates/${id}/testar`, form, iaTimeout)
      return data
    }
    const { data } = await api.post<TesteTemplateResultado>(`/api/templates/${id}/testar`, { valores: filled }, iaTimeout)
    return data
  },
  async rules(id: string) {
    const { data } = await api.get<{ data: RegraValidacao[] }>(`/api/templates/${id}/regras`)
    return data.data
  },
  async createRule(id: string, payload: Partial<RegraValidacao>) {
    const { data } = await api.post<RegraValidacao>(`/api/templates/${id}/regras`, payload)
    return data
  },
  async updateRule(id: string, payload: Partial<RegraValidacao>) {
    const { data } = await api.put<RegraValidacao>(`/api/regras/${id}`, payload)
    return data
  },
  async removeRule(id: string) {
    return api.delete(`/api/regras/${id}`)
  },
}
