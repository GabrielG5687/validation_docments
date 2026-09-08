<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import type { Template } from '../../types'
import { countCampos } from '../../utils/estrutura'
import { relativeTime } from '../../utils/templateStatus'
import TemplateStatusBadge from './TemplateStatusBadge.vue'

defineProps<{ template: Template }>()
</script>

<template>
  <RouterLink :to="`/templates/${template.id}`" class="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary hover:shadow-md">
    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
      <FileText class="h-6 w-6" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate font-semibold text-slate-900">{{ template.nome }}</h3>
        <TemplateStatusBadge :template="template" />
      </div>
      <p class="mt-0.5 truncate text-sm text-slate-500">{{ template.descricao || template.categoria || 'Sem descrição' }}</p>
      <p class="mt-1 text-xs text-slate-500">
        {{ countCampos(template.estrutura) }} campos · {{ template._count?.regras ?? 0 }} regras · v{{ template.versaoAtual }}
        <span class="mx-1">·</span>
        {{ relativeTime(template.atualizadoEm || template.criadoEm) }}
      </p>
    </div>
  </RouterLink>
</template>
