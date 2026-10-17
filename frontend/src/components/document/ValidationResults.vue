<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, CheckCircle, CircleHelp, SearchX, XCircle } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { ResultadoRegra, StatusRegra } from '../../types'

const props = defineProps<{ results?: ResultadoRegra[] }>()

const ESTADOS: Record<StatusRegra, { icone: Component; classe: string; rotulo: string }> = {
  aprovado: { icone: CheckCircle, classe: 'text-green-600', rotulo: 'Conforme' },
  nao_conforme: { icone: XCircle, classe: 'text-red-600', rotulo: 'Não conforme' },
  nao_encontrado: { icone: SearchX, classe: 'text-slate-500', rotulo: 'Não encontrado' },
  extracao_conflitante: { icone: AlertTriangle, classe: 'text-orange-600', rotulo: 'Leitura em conflito' },
  nao_verificavel: { icone: CircleHelp, classe: 'text-amber-600', rotulo: 'Não verificável' },
}

const itens = computed(() => (props.results || []).map((result) => ({
  result,
  estado: ESTADOS[result.status] ?? ESTADOS.nao_verificavel,
})))
</script>
<template>
  <div class="space-y-2">
    <div v-if="!itens.length" class="muted">Nenhuma validação registrada.</div>
    <div v-for="{ result, estado } in itens" :key="result.id" class="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
      <component :is="estado.icone" class="mt-0.5 h-5 w-5" :class="estado.classe" aria-hidden="true" />
      <div>
        <p class="font-medium">{{ result.regra?.nome || result.regraId }}</p>
        <p class="text-xs font-semibold" :class="estado.classe">{{ estado.rotulo }}</p>
        <p v-if="result.explicacaoIa" class="mt-1 text-sm text-slate-700">{{ result.explicacaoIa }}</p>
        <p class="text-xs text-slate-600">{{ result.criterio || 'Resultado da regra' }}<span v-if="result.valorEncontrado"> · Valor: {{ result.valorEncontrado }}</span></p>
      </div>
    </div>
  </div>
</template>
