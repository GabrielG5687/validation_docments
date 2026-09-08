<script setup lang="ts">
defineProps<{ open: boolean; title: string }>()
defineEmits<{ close: [] }>()
</script>
<template><Teleport to="body"><div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" :aria-label="title" @keydown.esc="$emit('close')"><div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"><div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-bold">{{ title }}</h2><button class="text-2xl text-slate-500" aria-label="Fechar" @click="$emit('close')">×</button></div><slot /></div></div></Teleport></template>
