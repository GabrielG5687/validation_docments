<script setup lang="ts">
import { computed } from 'vue'

type Campo = {
  chave: string
  valorBruto: string | null
  valorNormalizado: string | null
  confianca: string
  origem: string
  status: string
  evidencia?: { texto: string; pagina: number; verificada: boolean } | null
}

const props = defineProps<{ dados?: Record<string, unknown> | null }>()

const extracao = computed(() => {
  const raw = props.dados?._extracao
  if (!raw || typeof raw !== 'object') return null
  const registro = raw as { diagnostico?: string; ia?: string; campos?: Campo[] }
  if (!Array.isArray(registro.campos)) return null
  return registro
})

const rotulo: Record<string, string> = {
  validado: 'Evidência verificada',
  ambiguo: 'Ambíguo',
  sem_evidencia: 'Sem evidência',
  conflito: 'Conflito',
  corrigido_humano: 'Corrigido',
}

function classe(status: string) {
  if (status === 'validado') return 'bg-emerald-50 text-emerald-700'
  if (status === 'conflito' || status === 'ambiguo') return 'bg-amber-50 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}
</script>
<template>
  <section v-if="extracao" class="card">
    <h2 class="text-lg font-bold">Evidências da extração</h2>
    <p class="mt-1 text-sm text-ink-muted">Diagnóstico: {{ extracao.diagnostico }} · IA: {{ extracao.ia }}</p>
    <ul class="mt-4 space-y-3">
      <li v-for="campo in extracao.campos" :key="campo.chave" class="rounded-lg border border-line p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold text-ink">{{ campo.chave }}</p>
          <span :class="['rounded-full px-2.5 py-1 text-xs font-semibold', classe(campo.status)]">{{ rotulo[campo.status] || campo.status }}</span>
        </div>
        <p class="mt-1 text-sm text-ink">{{ campo.valorNormalizado || campo.valorBruto || 'Não confirmado' }}</p>
        <p class="mt-1 text-xs text-ink-muted">{{ campo.origem }} · confiança {{ campo.confianca }}<span v-if="campo.evidencia"> · página {{ campo.evidencia.pagina }}</span></p>
        <p v-if="campo.evidencia?.texto" class="mt-2 text-xs text-slate-600">“{{ campo.evidencia.texto }}”</p>
      </li>
    </ul>
  </section>
</template>
