<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { reportService } from '../../services/reportService'
import { useDashboardPolling } from '../../composables/useDashboardPolling'
import StatCard from '../../components/dashboard/StatCard.vue'
import DocumentCard from '../../components/document/DocumentCard.vue'
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
