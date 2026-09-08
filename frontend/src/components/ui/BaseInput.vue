<script setup lang="ts">
defineProps<{ label: string; id: string; modelValue?: string; type?: string; placeholder?: string; error?: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template><div><label :for="id" class="mb-1 block text-sm font-medium text-slate-700">{{ label }}</label><input :id="id" :type="type || 'text'" :value="modelValue" :placeholder="placeholder" :aria-invalid="!!error" :aria-describedby="error ? `${id}-error` : undefined" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-primary" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" /><p v-if="error" :id="`${id}-error`" class="mt-1 text-sm text-red-700">{{ error }}</p></div></template>
