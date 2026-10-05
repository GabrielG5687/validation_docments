<script setup lang="ts">
import type { ValidadeStatus } from '../../types'
import { corValidade, rotuloValidade } from '../../utils/validade'
const props = defineProps<{ status?: ValidadeStatus | null; diasParaVencer?: number | null; dataValidade?: string | null }>()
const label = rotuloValidade(props.status, props.diasParaVencer)
const colors = corValidade(props.status)
</script>
<template>
  <span v-if="status && label" :class="['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', colors.bg, colors.text]">
    <span class="h-2 w-2 rounded-full" :class="colors.dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>