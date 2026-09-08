<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNotificationStore } from './stores/notification'
const route = useRoute(); const notifications = useNotificationStore()
const layout = computed(() => route.meta.layout === 'auth' ? 'AuthLayout' : route.meta.layout === 'public' ? 'PublicLayout' : 'DefaultLayout')
</script>
<template><component :is="layout" /><div class="fixed right-4 top-4 z-[60] w-[min(22rem,calc(100vw-2rem))] space-y-2"><div v-for="toast in notifications.toasts" :key="toast.id" class="rounded-lg border bg-white p-3 text-sm shadow-lg" :class="toast.type === 'error' ? 'border-red-200 text-red-800' : toast.type === 'success' ? 'border-green-200 text-green-800' : 'border-slate-200 text-slate-800'">{{ toast.message }}</div></div></template>
