import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { authService } from '../services/authService'

let sessionHydrated = false

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: () => import('../pages/auth/LoginPage.vue'), meta: { public: true, layout: 'auth' } },
  { path: '/cadastro', component: () => import('../pages/auth/RegisterPage.vue'), meta: { public: true, layout: 'auth' } },
  { path: '/convite/:token', component: () => import('../pages/auth/InvitePage.vue'), meta: { public: true, layout: 'auth' } },
  { path: '/callback', component: () => import('../pages/auth/CallbackPage.vue'), meta: { public: true, layout: 'auth' } },
  { path: '/verificar/:codigo?', component: () => import('../pages/public/VerifyPage.vue'), meta: { public: true, layout: 'public' } },
  { path: '/dashboard', component: () => import('../pages/dashboard/DashboardPage.vue') },
  { path: '/documentos', component: () => import('../pages/documents/MyDocumentsPage.vue'), meta: { roles: ['usuario'] } },
  { path: '/documentos/todos', component: () => import('../pages/documents/AllDocumentsPage.vue'), meta: { roles: ['validador', 'coordenador', 'admin'] } },
  { path: '/documentos/upload', component: () => import('../pages/documents/UploadPage.vue'), meta: { roles: ['usuario'] } },
  { path: '/documentos/:id', component: () => import('../pages/documents/DocumentDetailPage.vue') },
  { path: '/validacao/fila', component: () => import('../pages/validation/QueuePage.vue'), meta: { roles: ['validador', 'coordenador', 'admin'] } },
  { path: '/validacao/:id', component: () => import('../pages/validation/WorkspacePage.vue'), meta: { roles: ['validador', 'coordenador', 'admin'] } },
  { path: '/templates', component: () => import('../pages/templates/TemplatesPage.vue') },
  { path: '/templates/:id', component: () => import('../pages/templates/TemplateStudioPage.vue'), meta: { studio: true } },
  { path: '/templates/:id/regras', redirect: (to) => ({ path: `/templates/${String(to.params.id)}`, query: { step: 'regras' } }) },
  { path: '/templates/:id/versoes', component: () => import('../pages/templates/TemplateVersionsPage.vue') },
  { path: '/relatorios', component: () => import('../pages/reports/ReportsPage.vue'), meta: { roles: ['coordenador', 'admin'] } },
  { path: '/usuarios', component: () => import('../pages/users/UsersPage.vue'), meta: { roles: ['admin'] } },
  { path: '/membros', component: () => import('../pages/empresa/MembrosPage.vue') },
  { path: '/entidades', component: () => import('../pages/entidades/EntidadesPage.vue') },
  { path: '/entidades/:id', component: () => import('../pages/entidades/EntidadeDetailPage.vue') },
]
const router = createRouter({ history: createWebHistory(), routes })
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.token && !sessionHydrated) {
    sessionHydrated = true
    try {
      const me = await authService.me()
      auth.setSession(me.user, auth.token, me.empresas, auth.empresaAtivaId || me.empresas[0]?.id)
    } catch {
      auth.logout()
    }
  }

  if (to.meta.public) return true
  if (!auth.token) return { path: '/login', query: { redirect: to.fullPath } }
  const roles = to.meta.roles as string[] | undefined
  if (roles && (!auth.perfil || !roles.includes(auth.perfil))) return '/dashboard'
  if (to.path === '/membros' && !auth.temPermissaoEmpresa('members.view')) return '/dashboard'
  return true
})
export default router
