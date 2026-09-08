<script setup lang="ts">
defineProps<{ loading?: boolean; empty?: string }>()
</script>
<template><div class="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table class="min-w-full divide-y divide-slate-200 text-left text-sm"><slot name="head" /><tbody class="divide-y divide-slate-100"><tr v-if="loading"><td colspan="99"><div class="p-6 text-center text-slate-500">Carregando…</div></td></tr><tr v-else-if="empty"><td colspan="99" class="p-8 text-center text-slate-500">{{ empty }}</td></tr><slot v-else /></tbody></table></div></template>
