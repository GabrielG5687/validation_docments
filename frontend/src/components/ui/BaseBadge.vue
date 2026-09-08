<script setup lang="ts">
import { STATUS_CONFIG } from '../../utils/statusColor'
import type { StatusDocumento } from '../../types'
const props = defineProps<{ status: StatusDocumento | string }>()
const fallback = { label: props.status, colorClass: 'text-slate-700', bgClass: 'bg-slate-100', icon: undefined }
</script>
<template><span :class="[ (STATUS_CONFIG[status as StatusDocumento] || fallback).bgClass, (STATUS_CONFIG[status as StatusDocumento] || fallback).colorClass, 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold']" role="status" :aria-label="(STATUS_CONFIG[status as StatusDocumento] || fallback).label"><component v-if="(STATUS_CONFIG[status as StatusDocumento] || fallback).icon" :is="(STATUS_CONFIG[status as StatusDocumento] || fallback).icon" class="h-3.5 w-3.5" aria-hidden="true" />{{ (STATUS_CONFIG[status as StatusDocumento] || fallback).label }}</span></template>
