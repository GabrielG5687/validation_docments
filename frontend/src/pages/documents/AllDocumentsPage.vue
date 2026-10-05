<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDocumentStore } from '../../stores/document'
import { formatDate } from '../../utils/formatDate'
import BaseTable from '../../components/ui/BaseTable.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import ValidadeSeal from '../../components/document/ValidadeSeal.vue'
const store = useDocumentStore(); const search = ref(''); const validade = ref('')
async function load() {
  const params: Record<string, string> = {}
  if (search.value) params.search = search.value
  if (validade.value) params.validade = validade.value
  await store.list(Object.keys(params).length ? params : undefined)
}
onMounted(load)
</script>
<template><div><h1 class="page-title mb-6">Todos os documentos</h1><div class="mb-4 flex max-w-lg gap-2"><BaseInput id="document-search" v-model="search" label="Buscar documento ou usuário" @keyup.enter="load" /><div class="mt-6"><select v-model="validade" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Filtrar por validade" @change="load"><option value="">Todas as validades</option><option value="proximos">Vencendo em breve</option><option value="vencido">Vencidos</option><option value="todos">Com validade</option></select></div><button class="mt-6 rounded-lg bg-primary px-4 text-sm font-semibold text-white" @click="load">Buscar</button></div><BaseSpinner v-if="store.loading" /><BaseTable v-else :empty="store.documentos.length ? undefined : 'Nenhum documento encontrado.'"><template #head><thead class="bg-slate-50"><tr><th class="px-4 py-3 font-semibold">Arquivo</th><th class="px-4 py-3 font-semibold">Usuário</th><th class="px-4 py-3 font-semibold">Status</th><th class="px-4 py-3 font-semibold">Validade</th><th class="px-4 py-3 font-semibold">Enviado em</th></tr></thead></template><tr v-for="document in store.documentos" :key="document.id" class="hover:bg-slate-50"><td class="px-4 py-3"><RouterLink :to="`/documentos/${document.id}`" class="font-medium text-primary">{{ document.nomeArquivo }}</RouterLink><div class="text-xs text-slate-500">{{ document.template?.nome }}</div></td><td class="px-4 py-3">{{ document.usuario?.nome || '—' }}</td><td class="px-4 py-3"><BaseBadge :status="document.status" /></td><td class="px-4 py-3"><ValidadeSeal :status="document.statusValidade" :dias-para-vencer="document.diasParaVencer" /></td><td class="px-4 py-3">{{ formatDate(document.criadoEm) }}</td></tr></BaseTable></div></template>