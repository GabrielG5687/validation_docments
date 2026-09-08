<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTemplateStore } from '../../stores/template'
import RuleList from '../../components/template/RuleList.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
const route = useRoute(); const store = useTemplateStore(); const template = ref(store.templates.find((t) => t.id === route.params.id))
onMounted(async () => { if (!template.value) { await store.list(); template.value = store.templates.find((t) => t.id === route.params.id) }; await store.loadRules(String(route.params.id)) })
</script>
<template><div><BaseSpinner v-if="store.loading && !template" /><template v-else><div class="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p class="muted">Template</p><h1 class="page-title">{{ template?.nome || 'Detalhes' }}</h1><p class="muted mt-1">{{ template?.descricao }}</p></div><div class="flex gap-2"><RouterLink :to="`/templates/${route.params.id}/versoes`" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Versões</RouterLink><RouterLink :to="`/templates/${route.params.id}/regras`" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Editar regras</RouterLink></div></div><section class="card"><h2 class="mb-4 text-lg font-bold">Regras de validação</h2><RuleList :rules="store.regras" /></section></template></div></template>
