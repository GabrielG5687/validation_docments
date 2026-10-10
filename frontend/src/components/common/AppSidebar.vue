<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { Building2, ChevronsUpDown, FileCheck, FileText, LayoutDashboard, Library, ListChecks, Settings2, Users, BarChart3, UserRound } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import type { PapelEmpresa } from '../../types'
import BrandLogo from './BrandLogo.vue'

defineProps<{ open?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const auth = useAuthStore()
const notice = useNotificationStore()
const route = useRoute()
const router = useRouter()

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['usuario', 'validador', 'coordenador', 'admin'], empresaPapeis: ['OWNER', 'ADMIN'] as PapelEmpresa[] },
  { to: '/documentos', label: 'Documentos', icon: FileText, roles: ['usuario'] },
  { to: '/documentos/todos', label: 'Documentos', icon: FileText, roles: ['validador', 'coordenador', 'admin'] },
  { to: '/validacao/fila', label: 'Revisão', icon: ListChecks, roles: ['usuario', 'validador', 'coordenador', 'admin'] },
  { to: '/entidades', label: 'Entidades', icon: Building2, roles: ['usuario', 'validador', 'coordenador', 'admin'] },
  { to: '/templates', label: 'Modelos', icon: Library, roles: ['usuario', 'validador', 'coordenador', 'admin'] },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['usuario', 'validador', 'coordenador', 'admin'], empresaPapeis: ['OWNER', 'ADMIN'] as PapelEmpresa[] },
  { to: '/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
  { to: '/membros', label: 'Membros', icon: UserRound, roles: ['usuario', 'validador', 'coordenador', 'admin'], empresaPerm: 'members.view' as const },
]

function rotuloPapel(papel?: PapelEmpresa) {
  if (papel === 'OWNER') return 'Proprietário'
  if (papel === 'ADMIN') return 'Admin'
  if (papel === 'MEMBER') return 'Membro'
  return ''
}

function itemVisivel(entry: (typeof items)[number]) {
  if (entry.to === '/validacao/fila') return auth.podeRevisar
  if (!auth.perfil || !entry.roles.includes(auth.perfil)) return false
  if ('empresaPerm' in entry && entry.empresaPerm && !auth.temPermissaoEmpresa(entry.empresaPerm)) return false
  if (entry.to === '/relatorios') return auth.podeVerRelatorios
  if ('empresaPapeis' in entry && entry.empresaPapeis && !entry.empresaPapeis.includes(auth.empresaAtiva?.papel || 'MEMBER')) return false
  return true
}

function selecionarOrganizacao(id: string) {
  if (id === auth.empresaAtivaId) return
  const empresa = auth.empresas.find((e) => e.id === id)
  auth.setEmpresaAtiva(id)
  notice.push({ type: 'success', message: `Agora em ${empresa?.nome || 'outra organização'}` })
  if ((route.path === '/dashboard' && !auth.podeVerDashboard) || (route.path === '/relatorios' && !auth.podeVerRelatorios)) {
    router.push(auth.destinoInicial)
  }
}
</script>
<template>
  <div v-if="open" class="fixed inset-0 z-30 bg-ink/30 lg:hidden" @click="emit('close')" />
  <aside :class="['fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full']">
    <div class="flex h-16 items-center px-5">
      <RouterLink :to="auth.destinoInicial" aria-label="ValidaDoc" @click="emit('close')">
        <BrandLogo size="md" />
      </RouterLink>
    </div>
    <nav class="flex-1 space-y-0.5 px-3" aria-label="Navegação principal">
      <RouterLink
        v-for="item in items.filter(itemVisivel)"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink"
        active-class="!bg-primary-light !text-primary"
        @click="emit('close')"
      >
        <component :is="item.icon" class="h-[18px] w-[18px]" />{{ item.label }}
      </RouterLink>
    </nav>
    <div class="space-y-3 border-t border-line p-3">
      <RouterLink
        v-if="auth.perfil === 'usuario'"
        to="/documentos/upload"
        class="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
        @click="emit('close')"
      >
        <FileCheck class="h-4 w-4" />Enviar documento
      </RouterLink>
      <label v-if="auth.empresas.length > 1" class="block">
        <span class="mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          <Settings2 class="h-3 w-3" /> Organização
        </span>
        <span class="relative block">
          <select
            class="field appearance-none pr-8"
            :value="auth.empresaAtivaId"
            aria-label="Organização ativa"
            @change="selecionarOrganizacao(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="empresa in auth.empresas" :key="empresa.id" :value="empresa.id">
              {{ empresa.nome }} · {{ rotuloPapel(empresa.papel) }}
            </option>
          </select>
          <ChevronsUpDown class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        </span>
      </label>
      <p v-else-if="auth.empresaAtiva" class="rounded-lg bg-canvas px-3 py-2">
        <span class="block truncate text-sm font-semibold text-ink">{{ auth.empresaAtiva.nome }}</span>
        <span class="block text-xs text-ink-muted">{{ rotuloPapel(auth.empresaAtiva.papel) }}</span>
      </p>
    </div>
  </aside>
</template>
