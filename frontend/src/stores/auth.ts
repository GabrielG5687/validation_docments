import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Perfil, Usuario } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<Usuario | null>(JSON.parse(localStorage.getItem('docvalid_user') || 'null'))
  const token = ref(localStorage.getItem('docvalid_token') || '')
  const perfil = computed<Perfil | undefined>(() => user.value?.perfil)

  function setSession(nextUser: Usuario, nextToken: string) {
    user.value = nextUser
    token.value = nextToken
    localStorage.setItem('docvalid_user', JSON.stringify(nextUser))
    localStorage.setItem('docvalid_token', nextToken)
    return nextUser
  }

  function logout() {
    user.value = null
    token.value = ''
    localStorage.removeItem('docvalid_user')
    localStorage.removeItem('docvalid_token')
  }

  return { user, token, perfil, setSession, logout }
})
