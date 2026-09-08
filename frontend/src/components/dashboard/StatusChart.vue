<script setup lang="ts">
defineProps<{ values: Record<string, number> }>()
</script>
<template><div class="card"><h3 class="font-semibold">Distribuição por status</h3><div class="mt-4 space-y-2"><div v-for="(value, label) in values" :key="label" class="flex items-center justify-between text-sm"><span>{{ label }}</span><strong>{{ value }}</strong></div><p v-if="!Object.keys(values).length" class="muted">Sem dados para o período.</p></div></div></template>
