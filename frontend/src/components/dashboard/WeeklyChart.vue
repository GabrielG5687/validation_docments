<script setup lang="ts">
defineProps<{ values?: Array<{ label: string; value: number }> }>()
</script>
<template><div class="card"><h3 class="font-semibold">Evolução semanal</h3><div class="mt-4 flex h-32 items-end gap-2"><div v-for="item in values || []" :key="item.label" class="flex flex-1 flex-col items-center gap-1"><div class="w-full rounded-t bg-primary" :style="{ height: `${Math.max(item.value * 8, 4)}px` }" :title="`${item.value}`" /><span class="text-[10px] text-slate-500">{{ item.label }}</span></div><p v-if="!values?.length" class="muted">Sem dados para o período.</p></div></div></template>
