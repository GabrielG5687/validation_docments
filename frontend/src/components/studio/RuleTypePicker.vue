<script setup lang="ts">
import { Asterisk, Calculator, Regex, SlidersHorizontal } from 'lucide-vue-next'
import type { TipoRegra } from '../../types'
import { REGRA_LABELS } from '../../utils/regraCopy'

defineProps<{ selected?: TipoRegra }>()
const emit = defineEmits<{ select: [tipo: TipoRegra] }>()

const cards: Array<{ tipo: TipoRegra; icon: typeof Asterisk }> = [
  { tipo: 'campo_obrigatorio', icon: Asterisk },
  { tipo: 'formato', icon: Regex },
  { tipo: 'intervalo', icon: SlidersHorizontal },
  { tipo: 'calculo', icon: Calculator },
]
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <button
      v-for="card in cards"
      :key="card.tipo"
      type="button"
      class="rounded-xl border p-4 text-left transition hover:border-primary hover:shadow-sm"
      :class="selected === card.tipo ? 'border-primary bg-primary-light' : 'border-slate-200 bg-white'"
      @click="emit('select', card.tipo)"
    >
      <component :is="card.icon" class="mb-3 h-6 w-6 text-primary" />
      <p class="font-semibold text-slate-900">{{ REGRA_LABELS[card.tipo].title }}</p>
      <p class="mt-1 text-sm text-slate-600">{{ REGRA_LABELS[card.tipo].hint }}</p>
    </button>
  </div>
</template>
