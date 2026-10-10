<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, CheckCircle2, Clock3, FileText, UploadCloud } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { reportService } from '../../services/reportService'
import { useDashboardPolling } from '../../composables/useDashboardPolling'
import StatCard from '../../components/dashboard/StatCard.vue'
import ValidadeSeal from '../../components/document/ValidadeSeal.vue'
import DashboardAnalyzePanel from '../../components/dashboard/DashboardAnalyzePanel.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import { formatDate } from '../../utils/formatDate'

const auth = useAuthStore()
const data = ref<any>()
const loading = ref(true)
const error = ref('')
const canAnalyze = computed(() => ['usuario', 'admin'].includes(auth.perfil || ''))
const primeiroNome = computed(() => auth.user?.nome?.split(' ')[0] || 'usuário')
const documentosPath = computed(() => (auth.perfil === 'usuario' ? '/documentos' : '/documentos/todos'))
const acaoPrincipal = computed(() => {
  if (auth.perfil === 'usuario') return { to: '/documentos/upload', label: 'Enviar documento' }
  return { to: '/validacao/fila', label: 'Abrir fila de revisão' }
})

async function load() {
  try {
    data.value = await reportService.dashboard()
    error.value = ''
  } catch {
    error.value = 'Dashboard indisponível. Verifique a conexão com o backend.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
useDashboardPolling(load)
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="page-title">Olá, {{ primeiroNome }}</h1>
      <p class="muted mt-1">O que está conforme, o que vence e o que pede revisão.</p>
    </div>
    <BaseAlert v-if="error" type="warning" :message="error" class="mb-5" />
    <BaseSpinner v-if="loading" />
    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Documentos" :value="data?.contadores?.total ?? data?.metricas?.totais?.enviados ?? 0">
          <template #icon><FileText class="h-5 w-5" /></template>
        </StatCard>
        <StatCard label="Aguardando revisão" :value="data?.contadores?.aguardandoRevisao ?? data?.fila?.aguardandoRevisao ?? 0" tone="text-amber-700" hint="Próximo passo da fila">
          <template #icon><Clock3 class="h-5 w-5" /></template>
        </StatCard>
        <StatCard label="Aprovados" :value="data?.contadores?.aprovados ?? data?.metricas?.totais?.aprovados ?? 0" tone="text-emerald-700">
          <template #icon><CheckCircle2 class="h-5 w-5" /></template>
        </StatCard>
        <StatCard label="Reprovados" :value="data?.contadores?.reprovados ?? data?.metricas?.totais?.reprovados ?? 0" tone="text-red-700">
          <template #icon><AlertTriangle class="h-5 w-5" /></template>
        </StatCard>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-5">
        <RouterLink :to="acaoPrincipal.to" class="surface flex flex-col justify-between p-5 lg:col-span-3">
          <div>
            <p class="text-sm font-semibold text-ink">{{ auth.perfil === 'usuario' ? 'Enviar documentos' : 'Revisão pendente' }}</p>
            <p class="mt-1 max-w-md text-sm text-ink-muted">
              {{ auth.perfil === 'usuario' ? 'Arraste um PDF no envio ou escolha o arquivo para vincular a um modelo.' : 'Abra a fila para decidir os documentos que já passaram pelas regras.' }}
            </p>
          </div>
          <span class="mt-6 inline-flex h-24 items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary-light/40 text-sm font-semibold text-primary">
            <UploadCloud class="mr-2 h-5 w-5" />{{ acaoPrincipal.label }}
          </span>
        </RouterLink>
        <div v-if="data?.conformidade && (auth.perfil === 'admin' || auth.perfil === 'coordenador')" class="card flex flex-col justify-between lg:col-span-2">
          <div>
            <h2 class="text-sm font-semibold">Conformidade das entidades</h2>
            <p class="mt-1 text-sm text-ink-muted">{{ data.conformidade.totalEntidades ?? 0 }} cadastrada(s)</p>
          </div>
          <div>
            <p class="text-3xl font-semibold" :class="(data.conformidade.percentual ?? 0) >= 100 ? 'text-emerald-700' : 'text-primary'">{{ data.conformidade.percentual ?? 0 }}%</p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full bg-primary" :style="{ width: `${data.conformidade.percentual ?? 0}%` }" />
            </div>
            <p class="mt-2 text-xs text-ink-muted">{{ data.conformidade.itensPendentes ?? 0 }} pendência(s) · {{ data.conformidade.itensAtendidos ?? 0 }}/{{ data.conformidade.itensTotais ?? 0 }} itens</p>
            <RouterLink to="/entidades" class="mt-3 inline-flex text-sm font-semibold text-primary">Ver entidades</RouterLink>
          </div>
        </div>
        <RouterLink v-else to="/entidades" class="card flex flex-col justify-between lg:col-span-2">
          <div>
            <h2 class="text-sm font-semibold">Entidades e dossiês</h2>
            <p class="mt-1 text-sm text-ink-muted">Veja o que falta para cada empresa ou pessoa.</p>
          </div>
          <span class="text-sm font-semibold text-primary">Abrir entidades</span>
        </RouterLink>
      </div>

      <div v-if="canAnalyze" class="mt-6">
        <DashboardAnalyzePanel />
      </div>

      <section v-if="data?.vencendo30?.length" class="mt-8">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold">Vencendo em 30 dias</h2>
        </div>
        <div class="surface overflow-x-auto">
          <table class="min-w-full text-left">
            <thead class="bg-canvas">
              <tr>
                <th class="th">Documento</th>
                <th class="th">Contexto</th>
                <th class="th">Validade</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="doc in data.vencendo30" :key="doc.id" class="hover:bg-canvas/60">
                <td class="td"><RouterLink :to="`/documentos/${doc.id}`" class="font-medium text-primary">{{ doc.nomeArquivo }}</RouterLink></td>
                <td class="td text-ink-muted">{{ doc.template?.nome }}{{ doc.entidade ? ' · ' + doc.entidade.nome : '' }}</td>
                <td class="td"><ValidadeSeal :status="doc.statusValidade" :dias-para-vencer="doc.diasParaVencer" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="mt-8">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold">Documentos recentes</h2>
          <RouterLink :to="documentosPath" class="text-sm font-semibold text-primary">Ver todos</RouterLink>
        </div>
        <div class="surface overflow-x-auto">
          <table class="min-w-full text-left">
            <thead class="bg-canvas">
              <tr>
                <th class="th">Nome</th>
                <th class="th">Modelo</th>
                <th class="th">Enviado em</th>
                <th class="th">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="document in (data?.ultimosDocumentos || [])" :key="document.id" class="hover:bg-canvas/60">
                <td class="td font-medium"><RouterLink :to="`/documentos/${document.id}`" class="hover:text-primary">{{ document.nomeArquivo }}</RouterLink></td>
                <td class="td text-ink-muted">{{ document.template?.nome || '—' }}</td>
                <td class="td text-ink-muted">{{ formatDate(document.criadoEm) }}</td>
                <td class="td"><BaseBadge :status="document.status" /></td>
              </tr>
              <tr v-if="!data?.ultimosDocumentos?.length">
                <td colspan="4" class="px-5 py-10 text-center text-sm text-ink-muted">Nenhum documento recente. {{ auth.perfil === 'usuario' ? 'Envie o primeiro PDF.' : 'A fila aparece aqui quando houver envios.' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
