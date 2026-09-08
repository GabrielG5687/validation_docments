<script setup lang="ts">
import { LogOut, Menu, ShieldCheck } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
defineEmits<{ toggle: [] }>()
const auth = useAuthStore()
</script>
<template><header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6"><div class="flex items-center gap-3"><button class="rounded p-2 lg:hidden" aria-label="Abrir menu" @click="$emit('toggle')"><Menu class="h-5 w-5" /></button><RouterLink to="/dashboard" class="flex items-center gap-2 font-bold text-primary"><ShieldCheck class="h-6 w-6" />DocValid</RouterLink></div><div class="flex items-center gap-3"><span class="hidden text-sm text-slate-600 sm:inline">{{ auth.user?.nome }}</span><button class="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100" @click="auth.logout(); $router.push('/login')"><LogOut class="h-4 w-4" /> Sair</button></div></header></template>
