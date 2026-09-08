<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { reportService } from '../../services/reportService'
import type { Perfil, Usuario } from '../../types'
import BaseTable from '../../components/ui/BaseTable.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
const users = ref<Usuario[]>([]); const loading = ref(true); const profiles: Perfil[] = ['usuario', 'validador', 'coordenador', 'admin']
async function load() { loading.value = true; try { users.value = (await reportService.users()).data } finally { loading.value = false } }
async function update(user: Usuario) { const updated = await reportService.updateUser(user.id, { perfil: user.perfil, status: user.status }); Object.assign(user, updated) }
onMounted(load)
</script>
<template><div><h1 class="page-title mb-6">Usuários</h1><BaseSpinner v-if="loading" /><BaseTable v-else :empty="users.length ? undefined : 'Nenhum usuário encontrado.'"><template #head><thead class="bg-slate-50"><tr><th class="px-4 py-3 font-semibold">Nome</th><th class="px-4 py-3 font-semibold">E-mail</th><th class="px-4 py-3 font-semibold">Perfil</th><th class="px-4 py-3 font-semibold">Status</th></tr></thead></template><tr v-for="user in users" :key="user.id"><td class="px-4 py-3 font-medium">{{ user.nome }}</td><td class="px-4 py-3">{{ user.email }}</td><td class="px-4 py-3"><select v-model="user.perfil" class="rounded border p-1" @change="update(user)"><option v-for="profile in profiles" :key="profile" :value="profile">{{ profile }}</option></select></td><td class="px-4 py-3"><label class="inline-flex items-center gap-2"><input v-model="user.status" type="checkbox" @change="update(user)" /> {{ user.status ? 'Ativo' : 'Inativo' }}</label></td></tr></BaseTable></div></template>
