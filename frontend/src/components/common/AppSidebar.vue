<script setup lang="ts">
import { Building2, FileCheck, FileText, LayoutDashboard, Library, ListChecks, Users, BarChart3, UserRound } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
defineProps<{ open?: boolean }>()
const auth = useAuthStore()
const items = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['usuario', 'validador', 'coordenador', 'admin'] },
  { to: '/documentos', label: 'Meus documentos', icon: FileText, roles: ['usuario'] },
  { to: '/documentos/todos', label: 'Todos os documentos', icon: FileText, roles: ['validador', 'coordenador', 'admin'] },
  { to: '/validacao/fila', label: 'Fila de validação', icon: ListChecks, roles: ['validador', 'coordenador', 'admin'] },
  { to: '/templates', label: 'Templates', icon: Library, roles: ['usuario', 'validador', 'coordenador', 'admin'] },
  { to: '/entidades', label: 'Entidades', icon: Building2, roles: ['usuario', 'validador', 'coordenador', 'admin'] },
  { to: '/membros', label: 'Equipe', icon: UserRound, roles: ['usuario', 'validador', 'coordenador', 'admin'], empresaPerm: 'members.view' as const },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['coordenador', 'admin'] },
  { to: '/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
]
</script>
<template>
  <aside :class="['fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white pt-20 transition lg:static lg:translate-x-0 lg:pt-0', open ? 'translate-x-0' : '-translate-x-full']">
    <nav class="space-y-1 p-4" aria-label="Navegação principal">
      <RouterLink
        v-for="item in items.filter((entry) => auth.perfil && entry.roles.includes(auth.perfil) && (!('empresaPerm' in entry) || !entry.empresaPerm || auth.temPermissaoEmpresa(entry.empresaPerm)))"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-primary-light hover:text-primary"
        active-class="bg-primary-light text-primary"
      >
        <component :is="item.icon" class="h-5 w-5" />{{ item.label }}
      </RouterLink>
      <RouterLink v-if="auth.perfil === 'usuario'" to="/documentos/upload" class="mt-5 flex items-center gap-3 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white">
        <FileCheck class="h-5 w-5" />Enviar documento
      </RouterLink>
    </nav>
  </aside>
</template>
