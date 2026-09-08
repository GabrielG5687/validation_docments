<script setup lang="ts">
defineProps<{ progress: number; status?: string }>()
</script>
<template><div class="space-y-2"><div class="flex justify-between text-sm"><span>{{ status || 'Enviando arquivo…' }}</span><span>{{ progress }}%</span></div><div class="h-2 overflow-hidden rounded-full bg-slate-200"><div class="h-full bg-primary transition-all" :style="{ width: `${progress}%` }" /></div></div></template>
