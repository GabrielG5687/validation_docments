<script setup lang="ts">
defineProps<{ label: string; value: string | number; tone?: string }>()
</script>
<template><div class="card"><p class="muted">{{ label }}</p><p class="mt-2 text-3xl font-bold" :class="tone || 'text-slate-900'">{{ value }}</p></div></template>
