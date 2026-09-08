<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Carregando' })
</script>
<template><div class="flex items-center justify-center gap-2 py-8 text-sm text-slate-600" role="status"><span class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />{{ label }}</div></template>
