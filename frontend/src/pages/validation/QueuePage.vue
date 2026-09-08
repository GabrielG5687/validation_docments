<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { documentService } from '../../services/documentService'
import type { Documento } from '../../types'
import { formatDate } from '../../utils/formatDate'
import BaseTable from '../../components/ui/BaseTable.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
const documents = ref<Documento[]>([]); const loading = ref(true)
onMounted(async () => { try { documents.value = (await documentService.pending()).data } finally { loading.value = false } })
</script>
<template><div><div class="mb-6"><p class="muted">Validação manual</p><h1 class="page-title">Fila de revisão</h1></div><BaseSpinner v-if="loading" /><BaseTable v-else :empty="documents.length ? undefined : 'A fila está vazia.'"><template #head><thead class="bg-slate-50"><tr><th class="px-4 py-3 font-semibold">Documento</th><th class="px-4 py-3 font-semibold">Usuário</th><th class="px-4 py-3 font-semibold">Enviado em</th><th class="px-4 py-3 font-semibold">Ação</th></tr></thead></template><tr v-for="document in documents" :key="document.id"><td class="px-4 py-3"><p class="font-medium">{{ document.nomeArquivo }}</p><p class="text-xs text-slate-500">{{ document.template?.nome }}</p></td><td class="px-4 py-3">{{ document.usuario?.nome }}</td><td class="px-4 py-3">{{ formatDate(document.criadoEm) }}</td><td class="px-4 py-3"><RouterLink :to="`/validacao/${document.id}`" class="text-sm font-semibold text-primary">Abrir revisão</RouterLink></td></tr></BaseTable></div></template>
