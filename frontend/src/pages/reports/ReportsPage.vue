<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { reportService } from '../../services/reportService'
import StatCard from '../../components/dashboard/StatCard.vue'
import StatusChart from '../../components/dashboard/StatusChart.vue'
import WeeklyChart from '../../components/dashboard/WeeklyChart.vue'
import ExportButton from '../../components/data/ExportButton.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import type { ReportData } from '../../types'
const report = ref<ReportData>(); const loading = ref(true); const start = ref(''); const end = ref('')
async function load() { loading.value = true; try { report.value = await reportService.reports({ ...(start.value ? { dataInicio: start.value } : {}), ...(end.value ? { dataFim: end.value } : {}) }) } finally { loading.value = false } }
onMounted(load)
</script>
<template><div><div class="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p class="muted">Indicadores</p><h1 class="page-title">Relatórios</h1></div><ExportButton /></div><div class="mb-6 flex flex-wrap items-end gap-3"><label class="text-sm font-medium">Data inicial<input v-model="start" type="date" class="mt-1 block rounded border p-2" /></label><label class="text-sm font-medium">Data final<input v-model="end" type="date" class="mt-1 block rounded border p-2" /></label><button class="rounded bg-primary px-4 py-2 text-sm font-semibold text-white" @click="load">Atualizar</button></div><BaseSpinner v-if="loading" /><template v-else-if="report"><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCard label="Enviados" :value="report.totais.enviados" /><StatCard label="Aprovados" :value="report.totais.aprovados"  /><StatCard label="Reprovados" :value="report.totais.reprovados"  /><StatCard label="Taxa de aprovação" :value="`${report.totais.taxaAprovacao}%`" /><StatCard label="Tempo médio" :value="`${report.totais.tempoMedioHoras}h`" /></div><div class="mt-6 grid gap-6 lg:grid-cols-2"><StatusChart :values="{ Aprovados: report.totais.aprovados, Reprovados: report.totais.reprovados, Processando: report.totais.emProcessamento }" /><WeeklyChart /></div><section class="card mt-6"><h2 class="mb-4 font-bold">Por validador</h2><div v-for="row in report.porValidador" :key="String(row.validador)" class="flex justify-between border-b py-2 text-sm"><span>{{ row.validador }}</span><span>{{ row.revisados }} revisados</span></div></section></template></div></template>
