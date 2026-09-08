<script setup lang="ts">
defineProps<{ modelValue?: string }>()
defineEmits<{ 'update:modelValue': [value: string]; search: [] }>()
</script>
<template><div class="flex flex-wrap items-end gap-3"><label class="text-sm font-medium">Buscar<input :value="modelValue" class="mt-1 rounded-lg border px-3 py-2" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" @keyup.enter="$emit('search')" /></label><button class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" @click="$emit('search')">Aplicar filtros</button></div></template>
