<script setup lang="ts">
defineProps<{ url?: string }>()
</script>
<template><div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-100"><iframe v-if="url" :src="url" title="Visualização do documento PDF" class="h-[520px] w-full" /><div v-else class="flex h-48 items-center justify-center text-sm text-slate-500">Pré-visualização indisponível</div></div></template>
