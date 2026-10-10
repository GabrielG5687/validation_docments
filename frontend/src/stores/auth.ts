import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { EmpresaResumo, Perfil, PermissaoEmpresa, Usuario } from '../types'

const EMPRESA_KEY = 'docvalid_empresa_ativa'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<Usuario | null>(JSON.parse(localStorage.getItem('docvalid_user') || 'null'))
  const token = ref(localStorage.getItem('docvalid_token') || '')
  const empresas = ref<EmpresaResumo[]>(JSON.parse(localStorage.getItem('docvalid_empresas') || '[]'))
  const empresaAtivaId = ref(localStorage.getItem(EMPRESA_KEY) || '')
  const perfil = computed<Perfil | undefined>(() => user.value?.perfil)

  const empresaAtiva = computed(() => empresas.value.find((e) => e.id === empresaAtivaId.value) || empresas.value[0] || null)

  /** Espelha `podeGerenciarTemplates` do backend: admin global ou OWNER da empresa ativa. */
  const podeGerenciarTemplates = computed(
    () => perfil.value === 'admin' || empresaAtiva.value?.papel === 'OWNER',
  )

  const podeVerDashboard = computed(() => {
    const papel = empresaAtiva.value?.papel
    return papel === 'OWNER' || papel === 'ADMIN'
  })

  const podeRevisar = computed(() => {
    const papel = empresaAtiva.value?.papel
    if (papel === 'OWNER' || papel === 'ADMIN') return true
    return perfil.value === 'validador' || perfil.value === 'coordenador' || perfil.value === 'admin'
  })

  const podeVerRelatorios = computed(() => {
    const papel = empresaAtiva.value?.papel
    if (papel === 'OWNER' || papel === 'ADMIN') return true
    return perfil.value === 'coordenador' || perfil.value === 'admin'
  })

  const destinoInicial = computed(() => {
    if (podeVerDashboard.value) return '/dashboard'
    if (perfil.value === 'usuario') return '/documentos'
    if (perfil.value === 'validador' || perfil.value === 'coordenador' || perfil.value === 'admin') return '/documentos/todos'
    return '/entidades'
  })

  function persistEmpresas(next: EmpresaResumo[], ativaId?: string) {
    empresas.value = next
    localStorage.setItem('docvalid_empresas', JSON.stringify(next))
    const chosen = ativaId && next.some((e) => e.id === ativaId)
      ? ativaId
      : (next.find((e) => e.id === empresaAtivaId.value)?.id || next[0]?.id || '')
    empresaAtivaId.value = chosen
    if (chosen) localStorage.setItem(EMPRESA_KEY, chosen)
    else localStorage.removeItem(EMPRESA_KEY)
  }

  function setSession(nextUser: Usuario, nextToken: string, nextEmpresas?: EmpresaResumo[], ativaId?: string) {
    user.value = nextUser
    token.value = nextToken
    localStorage.setItem('docvalid_user', JSON.stringify(nextUser))
    localStorage.setItem('docvalid_token', nextToken)
    if (nextEmpresas) persistEmpresas(nextEmpresas, ativaId)
    return nextUser
  }

  function setEmpresas(next: EmpresaResumo[], ativaId?: string) {
    persistEmpresas(next, ativaId)
  }

  function setEmpresaAtiva(id: string) {
    if (!empresas.value.some((e) => e.id === id)) return
    empresaAtivaId.value = id
    localStorage.setItem(EMPRESA_KEY, id)
  }

  function temPermissaoEmpresa(permissao: PermissaoEmpresa): boolean {
    return Boolean(empresaAtiva.value?.permissoes?.includes(permissao))
  }

  function logout() {
    user.value = null
    token.value = ''
    empresas.value = []
    empresaAtivaId.value = ''
    localStorage.removeItem('docvalid_user')
    localStorage.removeItem('docvalid_token')
    localStorage.removeItem('docvalid_empresas')
    localStorage.removeItem(EMPRESA_KEY)
  }

  return {
    user,
    token,
    perfil,
    empresas,
    empresaAtivaId,
    empresaAtiva,
    podeGerenciarTemplates,
    podeVerDashboard,
    podeVerRelatorios,
    podeRevisar,
    destinoInicial,
    setSession,
    setEmpresas,
    setEmpresaAtiva,
    temPermissaoEmpresa,
    logout,
  }
})
