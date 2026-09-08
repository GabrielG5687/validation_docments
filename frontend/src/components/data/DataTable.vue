<script setup lang="ts">
import FilterBar from './FilterBar.vue'
defineProps<{ search?: string; loading?: boolean }>()
defineEmits<{ 'update:search': [value: string]; search: [] }>()
</script>
<template><FilterBar :model-value="search" class="mb-4" @update:model-value="$emit('update:search', $event)" @search="$emit('search')" /><slot /></template>
