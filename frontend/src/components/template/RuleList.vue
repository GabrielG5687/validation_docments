<script setup lang="ts">
import type { RegraValidacao } from '../../types'
import BaseButton from '../ui/BaseButton.vue'
defineProps<{ rules: RegraValidacao[] }>()
defineEmits<{ edit: [rule: RegraValidacao]; remove: [rule: RegraValidacao] }>()
</script>
<template><div class="space-y-2"><div v-for="rule in rules" :key="rule.id" class="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p class="font-medium">{{ rule.ordem }}. {{ rule.nome }}</p><p class="text-xs text-slate-500">{{ rule.tipo }} · {{ rule.ativo ? 'ativa' : 'inativa' }}</p></div><div class="flex gap-2"><BaseButton variant="ghost" @click="$emit('edit', rule)">Editar</BaseButton><BaseButton variant="danger" @click="$emit('remove', rule)">Excluir</BaseButton></div></div><p v-if="!rules.length" class="muted">Nenhuma regra cadastrada.</p></div></template>
