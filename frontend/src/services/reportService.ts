import { api } from './api'
import type { DashboardData, ReportData, Usuario } from '../types'
export const reportService = {
  async dashboard() { const { data } = await api.get<DashboardData>('/api/dashboard'); return data },
  async reports(params?: Record<string, string>) { const { data } = await api.get<ReportData>('/api/relatorios', { params }); return data },
  async exportCsv(params?: Record<string, string>) { const response = await api.get('/api/relatorios/exportar', { params, responseType: 'blob' }); return response.data },
  async users(params?: Record<string, string>) { const { data } = await api.get<{ data: Usuario[]; total: number }>('/api/usuarios', { params }); return data },
  async updateUser(id: string, payload: Pick<Usuario, 'perfil' | 'status'>) { const { data } = await api.put<Usuario>(`/api/usuarios/${id}`, payload); return data },
}
