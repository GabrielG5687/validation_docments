<script setup lang="ts">
import { CheckCircle, XCircle } from 'lucide-vue-next'
import type { ResultadoRegra } from '../../types'
defineProps<{ results?: ResultadoRegra[] }>()
</script>
<template><div class="space-y-2"><div v-if="!results?.length" class="muted">Nenhuma validação registrada.</div><div v-for="result in results" :key="result.id" class="flex items-start gap-3 rounded-lg border border-slate-200 p-3"><CheckCircle v-if="result.status === 'aprovado'" class="mt-0.5 h-5 w-5 text-green-600" aria-hidden="true" /><XCircle v-else class="mt-0.5 h-5 w-5 text-red-600" aria-hidden="true" /><div><p class="font-medium">{{ result.regra?.nome || result.regraId }}</p><p v-if="result.explicacaoIa" class="mt-1 text-sm text-slate-700">{{ result.explicacaoIa }}</p><p class="text-xs text-slate-600">{{ result.criterio || 'Resultado da regra' }}<span v-if="result.valorEncontrado"> · Valor: {{ result.valorEncontrado }}</span></p></div></div></div></template>
