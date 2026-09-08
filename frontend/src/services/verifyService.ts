import { api } from './api'
export interface VerificationResult { valido: boolean; codigoVerificacao?: string; template?: string; dataAprovacao?: string; nomeValidador?: string; dataEnvio?: string; status?: string }
export const verifyService = {
  async verify(code: string) { const { data } = await api.get<VerificationResult>(`/api/verificar/${encodeURIComponent(code)}`); return data },
  async integrity(code: string, file: File) { const form = new FormData(); form.append('arquivo', file); const { data } = await api.post<{ integro: boolean; hashEnviado: string; hashOriginal: string }>(`/api/verificar/${encodeURIComponent(code)}/integridade`, form); return data },
}
