<script setup lang="ts">
import { formatDate } from '../../utils/formatDate'
import { STATUS_CONFIG } from '../../utils/statusColor'
import type { HistoricoStatus } from '../../types'
defineProps<{ history?: HistoricoStatus[] }>()
</script>
<template><ol class="space-y-4"><li v-for="item in [...(history || [])].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))" :key="item.id" class="relative flex gap-3"><span class="mt-1 h-3 w-3 rounded-full bg-primary" aria-hidden="true" /><div><p class="font-medium">{{ STATUS_CONFIG[item.statusNovo as keyof typeof STATUS_CONFIG]?.label || item.statusNovo }}</p><p class="text-xs text-slate-500">{{ formatDate(item.criadoEm) }}</p></div></li><li v-if="!history?.length" class="muted">Histórico ainda não disponível.</li></ol></template>
