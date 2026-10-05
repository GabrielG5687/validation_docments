<script setup lang="ts">
import type { DossieStatus } from '../../types'
const props = defineProps<{ status: DossieStatus }>()
const config = {
  em_compliance: { label: 'Em conformidade', text: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-500' },
  pendente: { label: 'Pendente', text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  aprovado: { label: 'Aprovado', text: 'text-sky-700', bg: 'bg-sky-50', dot: 'bg-sky-500' },
} as const
const c = config[props.status] || config.em_compliance
</script>
<template>
  <span :class="['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', c.bg, c.text]">
    <span class="h-2 w-2 rounded-full" :class="c.dot" aria-hidden="true" />
    {{ c.label }}
  </span>
</template>