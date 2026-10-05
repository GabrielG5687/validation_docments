import { api } from './api'
import type { ConviteEmpresa, ConvitePreview, EmpresaResumo, MembroEmpresa, PapelEmpresa } from '../types'

export const empresaService = {
  async listMinhas() {
    const { data } = await api.get<{ data: EmpresaResumo[] }>('/api/empresas')
    return data.data
  },
  async listMembros(empresaId: string, params?: { q?: string; papel?: string }) {
    const { data } = await api.get<{ data: MembroEmpresa[] }>(`/api/empresas/${empresaId}/membros`, { params })
    return data.data
  },
  async updateMembro(empresaId: string, memberId: string, papel: Exclude<PapelEmpresa, 'OWNER'>) {
    const { data } = await api.patch<MembroEmpresa>(`/api/empresas/${empresaId}/membros/${memberId}`, { papel })
    return data
  },
  async removeMembro(empresaId: string, memberId: string) {
    await api.delete(`/api/empresas/${empresaId}/membros/${memberId}`)
  },
  async listConvites(empresaId: string) {
    const { data } = await api.get<{ data: ConviteEmpresa[] }>(`/api/empresas/${empresaId}/convites`)
    return data.data
  },
  async criarConvite(empresaId: string, payload: { email: string; papel: Exclude<PapelEmpresa, 'OWNER'> }) {
    const { data } = await api.post<ConviteEmpresa>(`/api/empresas/${empresaId}/convites`, payload)
    return data
  },
  async reemitirConvite(empresaId: string, inviteId: string) {
    const { data } = await api.post<ConviteEmpresa>(`/api/empresas/${empresaId}/convites/${inviteId}/reemitir`)
    return data
  },
  async revogarConvite(empresaId: string, inviteId: string) {
    const { data } = await api.post<{ id: string; status: string }>(`/api/empresas/${empresaId}/convites/${inviteId}/revogar`)
    return data
  },
  async previewConvite(token: string) {
    const { data } = await api.get<ConvitePreview>(`/api/convites/${token}`)
    return data
  },
  async aceitarConvite(
    token: string,
    body?: { nome: string; senha: string; confirmarSenha: string; email?: string },
    options?: { asGuest?: boolean },
  ) {
    const { data } = await api.post<{
      membro: { id: string; papel: PapelEmpresa }
      empresa: { id: string; nome: string }
      user: import('../types').Usuario
      token: string
    }>(`/api/convites/${token}/aceitar`, body ?? {}, {
      skipAuth: Boolean(options?.asGuest),
      skipEmpresa: true,
    })
    return data
  },
}

export default empresaService
