<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { reportService } from '../../services/reportService'
import { useDashboardPolling } from '../../composables/useDashboardPolling'
import StatCard from '../../components/dashboard/StatCard.vue'
import DocumentCard from '../../components/document/DocumentCard.vue'
import ValidadeSeal from '../../components/document/ValidadeSeal.vue'
import DashboardAnalyzePanel from '../../components/dashboard/DashboardAnalyzePanel.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'

const auth = useAuthStore()
const data = ref<any>()
const loading = ref(true)
const error = ref('')
const canAnalyze = computed(() => ['usuario', 'admin'].includes(auth.perfil || ''))

async function load() {
  try {
    data.value = await reportService.dashboard()
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
      <p class="muted">Visão geral</p>
      <h1 class="page-title">Olá, {{ auth.user?.nome?.split(' ')[0] || 'usuário' }}!</h1>
    </div>
    <BaseAlert v-if="error" type="warning" :message="error" class="mb-5" />
    <BaseSpinner v-if="loading" />
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de documentos" :value="data?.contadores?.total ?? data?.metricas?.totais?.enviados ?? 0" />
        <StatCard label="Aguardando revisão" :value="data?.contadores?.aguardandoRevisao ?? data?.fila?.aguardandoRevisao ?? 0" tone="text-amber-700" />
        <StatCard label="Aprovados" :value="data?.contadores?.aprovados ?? data?.metricas?.totais?.aprovados ?? 0" tone="text-green-700" />
        <StatCard label="Reprovados" :value="data?.contadores?.reprovados ?? data?.metricas?.totais?.reprovados ?? 0" tone="text-red-700" />
      </div>
          <div v-if="canAnalyze" class="mt-8">
            <DashboardAnalyzePanel />
          </div>
      <div v-if="data?.vencendo30?.length" class="mt-8">
        <h2 class="text-lg font-bold">Vencendo em 30 dias</h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RouterLink v-for="doc in data.vencendo30" :key="doc.id" :to="`/documentos/${doc.id}`" class="card flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-semibold">{{ doc.nomeArquivo }}</p>
              <p class="muted truncate text-sm">{{ doc.template?.nome }}{{ doc.entidade ? ' · ' + doc.entidade.nome : '' }}</p>
            </div>
            <ValidadeSeal :status="doc.statusValidade" :dias-para-vencer="doc.diasParaVencer" />
          </RouterLink>
        </div>
      </div>
      <div v-if="data?.conformidade && (auth.perfil === 'admin' || auth.perfil === 'coordenador')" class="mt-8 grid gap-4 sm:grid-cols-2">
        <div class="card">
          <h2 class="font-semibold">Conformidade geral</h2>
          <p class="muted mt-1 text-sm">{{ data.conformidade.totalEntidades ?? 0 }} entidade(s) cadastrada(s)</p>
          <div class="mt-3 flex items-center gap-3">
            <span class="text-3xl font-bold" :class="(data.conformidade.percentual ?? 0) >= 100 ? 'text-green-600' : 'text-primary'">{{ data.conformidade.percentual ?? 0 }}%</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div class="h-full rounded-full" :class="(data.conformidade.percentual ?? 0) >= 100 ? 'bg-green-500' : 'bg-primary'" :style="{ width: `${data.conformidade.percentual ?? 0}%` }" />
            </div>
          </div>
          <p class="muted mt-1 text-sm">{{ data.conformidade.itensAtendidos ?? 0 }} de {{ data.conformidade.itensTotais ?? 0 }} itens atendidos ({{ data.conformidade.itensPendentes ?? 0 }} pendentes)</p>
        </div>
      </div>
      <div class="mt-8 flex items-center justify-between">
        <h2 class="text-lg font-bold">Documentos recentes</h2>
        <RouterLink :to="auth.perfil === 'usuario' ? '/documentos' : '/documentos/todos'" class="text-sm font-semibold text-primary">Ver todos</RouterLink>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DocumentCard v-for="document in (data?.ultimosDocumentos || [])" :key="document.id" :document="document" />
        <div v-if="!data?.ultimosDocumentos?.length" class="card muted md:col-span-2 lg:col-span-3">Nenhum documento recente.</div>
      </div>
    </template>
  </div>
</template>
