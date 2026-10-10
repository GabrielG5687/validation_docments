<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, LogOut, Menu, Search } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { entidadeService } from '../../services/entidadeService'
import type { Notificacao } from '../../types'
import { formatDate } from '../../utils/formatDate'

defineEmits<{ toggle: [] }>()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const aberto = ref(false)
const busca = ref('')
const buscaAberta = ref(false)
const notificacoes = ref<Notificacao[]>([])
const carregando = ref(false)
const naoLidas = computed(() => notificacoes.value.filter((n) => !n.lida).length)

const destinos = computed(() => {
  const q = busca.value.trim()
  const docs = auth.perfil === 'usuario' ? '/documentos' : '/documentos/todos'
  const itens = [
    { label: 'Documentos', to: { path: docs, query: q ? { q } : {} } },
    { label: 'Entidades', to: { path: '/entidades', query: q ? { q } : {} } },
    { label: 'Modelos', to: { path: '/templates', query: q ? { q } : {} } },
  ]
  if (auth.temPermissaoEmpresa('members.view')) {
    itens.splice(2, 0, { label: 'Membros', to: { path: '/membros', query: q ? { q } : {} } })
  }
  return itens
})

function iniciais(nome?: string) {
  return (nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
}

function rotuloPerfil(perfil?: string) {
  if (perfil === 'admin') return 'Administrador'
  if (perfil === 'coordenador') return 'Coordenador'
  if (perfil === 'validador') return 'Validador'
  return 'Usuário'
}

async function abrirPainel() {
  buscaAberta.value = false
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
    notificacoes.value.forEach((n) => { n.lida = true })
  } catch {
    /* silencioso */
  }
}

function irBusca() {
  const alvo = destinos.value[0]
  buscaAberta.value = false
  if (alvo) router.push(alvo.to)
}

const titulo = computed(() => {
  const path = route.path
  if (path.startsWith('/dashboard')) return 'Dashboard'
  if (path.startsWith('/documentos')) return 'Documentos'
  if (path.startsWith('/validacao')) return 'Revisão'
  if (path.startsWith('/entidades')) return 'Entidades'
  if (path.startsWith('/membros')) return 'Membros'
  if (path.startsWith('/templates')) return 'Modelos'
  if (path.startsWith('/relatorios')) return 'Relatórios'
  if (path.startsWith('/usuarios')) return 'Usuários'
  return 'ValidaDoc'
})
</script>
<template>
  <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6">
    <button class="rounded-lg p-2 text-ink lg:hidden" aria-label="Abrir menu" @click="$emit('toggle')">
      <Menu class="h-5 w-5" />
    </button>
    <p class="hidden text-sm font-semibold text-ink sm:block lg:hidden">{{ titulo }}</p>
    <form class="relative ml-auto hidden min-w-0 max-w-xl flex-1 md:block" @submit.prevent="irBusca">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <input
        v-model="busca"
        class="field h-10 bg-canvas pl-9"
        placeholder="Buscar documentos, entidades ou membros"
        aria-label="Busca global"
        @focus="buscaAberta = true"
      />
      <div v-if="buscaAberta && busca.trim()" class="absolute left-0 right-0 top-12 overflow-hidden rounded-xl border border-line bg-white shadow-pop">
        <button
          v-for="item in destinos"
          :key="item.label"
          type="button"
          class="menu-item"
          @mousedown.prevent="buscaAberta = false; router.push(item.to)"
        >
          Buscar “{{ busca.trim() }}” em {{ item.label }}
        </button>
      </div>
    </form>
    <div class="ml-auto flex items-center gap-1 md:ml-0">
      <div class="relative">
        <button class="relative rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink" :aria-expanded="aberto" aria-label="Notificações" @click="abrirPainel">
          <Bell class="h-5 w-5" />
          <span v-if="naoLidas" class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{{ naoLidas }}</span>
        </button>
        <div v-if="aberto" class="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          <div class="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span class="text-sm font-semibold">Notificações</span>
            <button v-if="naoLidas" class="text-xs font-semibold text-primary hover:underline" @click="marcarTodas">Marcar todas como lidas</button>
          </div>
          <div class="max-h-80 overflow-y-auto">
            <p v-if="carregando" class="p-4 text-sm text-ink-muted">Carregando…</p>
            <p v-else-if="!notificacoes.length" class="p-4 text-sm text-ink-muted">Nenhuma notificação.</p>
            <button v-for="n in notificacoes" :key="n.id" class="block w-full border-b border-line/70 px-4 py-3 text-left hover:bg-canvas" @click="abrirNotificacao(n)">
              <div class="flex items-start gap-2">
                <span v-if="!n.lida" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div class="min-w-0">
                  <p class="text-sm font-semibold" :class="n.lida ? 'text-ink-muted' : 'text-ink'">{{ n.titulo }}</p>
                  <p class="text-xs text-ink-muted">{{ n.mensagem }}</p>
                  <p class="mt-0.5 text-xs text-slate-400">{{ formatDate(n.criadoEm) }}</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
      <div class="ml-1 hidden items-center gap-2 rounded-lg py-1 pl-1 pr-2 sm:flex">
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">{{ iniciais(auth.user?.nome) }}</span>
        <span class="leading-tight">
          <span class="block max-w-[140px] truncate text-sm font-semibold text-ink">{{ auth.user?.nome }}</span>
          <span class="block text-xs text-ink-muted">{{ rotuloPerfil(auth.perfil) }}</span>
        </span>
      </div>
      <button class="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Sair" @click="auth.logout(); $router.push('/login')">
        <LogOut class="h-4 w-4" />
      </button>
    </div>
  </header>
</template>
