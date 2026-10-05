<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, ChevronsUpDown, LogOut, Menu } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import { entidadeService } from '../../services/entidadeService'
import type { Notificacao, PapelEmpresa } from '../../types'
import { formatDate } from '../../utils/formatDate'
import BrandLogo from './BrandLogo.vue'

defineEmits<{ toggle: [] }>()
const auth = useAuthStore()
const notice = useNotificationStore()
const router = useRouter()
const aberto = ref(false)
const orgAberto = ref(false)
const notificacoes = ref<Notificacao[]>([])
const carregando = ref(false)
const naoLidas = computed(() => notificacoes.value.filter((n) => !n.lida).length)

function rotuloPapel(papel?: PapelEmpresa) {
  if (papel === 'OWNER') return 'Proprietário'
  if (papel === 'ADMIN') return 'Admin'
  if (papel === 'MEMBER') return 'Membro'
  return ''
}

async function abrirPainel() {
  orgAberto.value = false
  aberto.value = !aberto.value
  if (!aberto.value) return
  carregando.value = true
  try {
    const res = await entidadeService.notificacoes()
    notificacoes.value = res.data
  } catch {
    notificacoes.value = []
  } finally {
    carregando.value = false
  }
}

async function abrirNotificacao(notificacao: Notificacao) {
  if (!notificacao.lida) {
    await entidadeService.marcarLida(notificacao.id).catch(() => undefined)
    notificacao.lida = true
  }
  aberto.value = false
  if (notificacao.documentoId) router.push(`/documentos/${notificacao.documentoId}`)
  else if (notificacao.entidadeId) router.push(`/entidades/${notificacao.entidadeId}`)
  else if (notificacao.dossieId) router.push('/entidades')
}

async function marcarTodas() {
  try {
    await entidadeService.marcarTodasLidas()
    notificacoes.value.forEach((n) => (n.lida = true))
  } catch {
    /* silencioso */
  }
}

function selecionarOrganizacao(id: string) {
  if (id === auth.empresaAtivaId) {
    orgAberto.value = false
    return
  }
  const empresa = auth.empresas.find((e) => e.id === id)
  auth.setEmpresaAtiva(id)
  orgAberto.value = false
  notice.push({ type: 'success', message: `Agora em ${empresa?.nome || 'outra organização'}` })
}
</script>
<template>
  <header class="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
    <div class="flex items-center gap-3">
      <button class="rounded p-2 lg:hidden" aria-label="Abrir menu" @click="$emit('toggle')"><Menu class="h-5 w-5" /></button>
      <RouterLink to="/dashboard" class="flex items-center" aria-label="ValidaDoc — Dashboard">
        <BrandLogo size="lg" />
      </RouterLink>
    </div>
    <div class="flex items-center gap-2 sm:gap-3">
      <div v-if="auth.empresas.length" class="relative">
        <button
          type="button"
          class="flex max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left hover:bg-slate-100"
          :aria-expanded="orgAberto"
          aria-label="Organização ativa"
          @click="orgAberto = !orgAberto; aberto = false"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold text-slate-800">{{ auth.empresaAtiva?.nome || 'Organização' }}</span>
            <span v-if="auth.empresaAtiva?.papel" class="block truncate text-xs text-slate-500">{{ rotuloPapel(auth.empresaAtiva.papel) }}</span>
          </span>
          <ChevronsUpDown class="h-4 w-4 shrink-0 text-slate-400" />
        </button>
        <div v-if="orgAberto" class="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <p class="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Espaço de trabalho</p>
          <button
            v-for="empresa in auth.empresas"
            :key="empresa.id"
            type="button"
            class="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
            :class="empresa.id === auth.empresaAtivaId ? 'bg-primary-light' : ''"
            @click="selecionarOrganizacao(empresa.id)"
          >
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-slate-900">{{ empresa.nome }}</span>
              <span class="block text-xs text-slate-500">{{ rotuloPapel(empresa.papel) }}</span>
            </span>
          </button>
        </div>
      </div>

      <div class="relative">
        <button class="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" :aria-expanded="aberto" aria-label="Notificações" @click="abrirPainel">
          <Bell class="h-5 w-5" />
          <span v-if="naoLidas" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">{{ naoLidas }}</span>
        </button>
        <div v-if="aberto" class="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span class="text-sm font-semibold">Notificações</span>
            <button v-if="naoLidas" class="text-xs font-semibold text-primary hover:underline" @click="marcarTodas">Marcar todas como lidas</button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <p v-if="carregando" class="muted p-4 text-sm">Carregando…</p>
            <p v-else-if="!notificacoes.length" class="muted p-4 text-sm">Nenhuma notificação.</p>
            <button v-for="n in notificacoes" :key="n.id" class="block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50" @click="abrirNotificacao(n)">
              <div class="flex items-start gap-2">
                <span v-if="!n.lida" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div class="min-w-0">
                  <p class="text-sm font-semibold" :class="n.lida ? 'text-slate-500' : 'text-slate-900'">{{ n.titulo }}</p>
                  <p class="text-xs text-slate-500">{{ n.mensagem }}</p>
                  <p class="mt-0.5 text-xs text-slate-400">{{ formatDate(n.criadoEm) }}</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
      <span class="hidden text-sm text-slate-600 sm:inline">{{ auth.user?.nome }}</span>
      <button class="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100" @click="auth.logout(); $router.push('/login')"><LogOut class="h-4 w-4" /> Sair</button>
    </div>
  </header>
</template>
