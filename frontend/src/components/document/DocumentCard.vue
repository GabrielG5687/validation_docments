<script setup lang="ts">
import type { Documento } from '../../types'
import { formatDate } from '../../utils/formatDate'
import { analiseAprovada } from '../../utils/analiseStatus'
import BaseBadge from '../ui/BaseBadge.vue'
import ApprovalSeal from './ApprovalSeal.vue'
import ValidadeSeal from './ValidadeSeal.vue'
defineProps<{ document: Documento }>()
</script>
<template>
  <RouterLink :to="`/documentos/${document.id}`" class="card relative block overflow-hidden transition hover:-translate-y-0.5 hover:border-primary">
    <ApprovalSeal v-if="analiseAprovada(document)" compact class="absolute right-3 top-3" />
    <div class="flex items-start justify-between gap-3 pr-16">
      <div>
        <h3 class="font-semibold text-slate-900">{{ document.nomeArquivo }}</h3>
        <p class="muted mt-1">{{ document.template?.nome || 'Template não informado' }}</p>
      </div>
      <BaseBadge :status="document.status" />
    </div>
    <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
      <span>{{ formatDate(document.criadoEm) }}</span>
      <ValidadeSeal v-if="document.status === 'aprovado'" :status="document.statusValidade" :dias-para-vencer="document.diasParaVencer" />
    </div>
  </RouterLink>
</template>
