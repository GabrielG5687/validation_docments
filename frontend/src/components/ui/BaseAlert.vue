<script setup lang="ts">
import { AlertCircle, CheckCircle, Info, TriangleAlert } from 'lucide-vue-next'
withDefaults(defineProps<{ type?: 'error' | 'success' | 'warning' | 'info'; message: string }>(), { type: 'info' })
</script>
<template><div role="alert" :class="['flex items-start gap-2 rounded-lg border p-3 text-sm', type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : type === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800']"><CheckCircle v-if="type === 'success'" class="h-5 w-5 shrink-0" /><AlertCircle v-else-if="type === 'error'" class="h-5 w-5 shrink-0" /><TriangleAlert v-else-if="type === 'warning'" class="h-5 w-5 shrink-0" /><Info v-else class="h-5 w-5 shrink-0" />{{ message }}</div></template>
