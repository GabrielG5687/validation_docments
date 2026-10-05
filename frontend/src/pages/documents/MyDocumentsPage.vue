<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDocumentStore } from '../../stores/document'
import DocumentCard from '../../components/document/DocumentCard.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'
const store = useDocumentStore()
const validade = ref('')
async function load() {
  const params: Record<string, string> = {}
  if (validade.value) params.validade = validade.value
  await store.list(Object.keys(params).length ? params : undefined).catch(() => undefined)
}
onMounted(load)
</script>
<template><div><div class="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p class="muted">Área do usuário</p><h1 class="page-title">Meus documentos</h1></div><div class="flex items-end gap-2"><select v-model="validade" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Filtrar por validade" @change="load"><option value="">Todas as validades</option><option value="proximos">Vencendo em breve</option><option value="vencido">Vencidos</option><option value="todos">Com validade</option></select><RouterLink to="/documentos/upload" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Enviar documento</RouterLink></div></div><BaseAlert v-if="store.error" type="error" :message="store.error" /><BaseSpinner v-if="store.loading" /><div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><DocumentCard v-for="document in store.documentos" :key="document.id" :document="document" /><div v-if="!store.documentos.length" class="card muted md:col-span-2 xl:col-span-3">Você ainda não enviou documentos.</div></div></div></template>