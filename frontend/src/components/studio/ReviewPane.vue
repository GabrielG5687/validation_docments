<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
import type { CampoTemplate, EstruturaTemplate, RegraValidacao, Template } from '../../types'
import { countCampos, countSecoes } from '../../utils/estrutura'
import { describeRegra } from '../../utils/regraCopy'
import TemplateStatusBadge from '../template/TemplateStatusBadge.vue'
import BaseButton from '../ui/BaseButton.vue'

defineProps<{
  template: Template
  info: { nome: string; descricao: string; categoria: string }
  estrutura: EstruturaTemplate
  campos: CampoTemplate[]
  regras: RegraValidacao[]
  publishing?: boolean
  readOnly?: boolean
  nextVersion: string
}>()

const emit = defineEmits<{ publish: []; test: [] }>()
</script>

<template>
  <div class="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1.2fr_0.8fr]">
    <div class="space-y-4">
      <section class="card">
        <h2 class="mb-3 text-lg font-bold">Informações básicas</h2>
        <dl class="grid gap-2 text-sm">
          <div class="flex justify-between gap-4"><dt class="text-slate-500">Nome</dt><dd class="font-medium">{{ info.nome }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-slate-500">Tipo</dt><dd class="font-medium">{{ info.categoria || '—' }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-slate-500">Versão atual</dt><dd class="font-medium">v{{ template.versaoAtual }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-slate-500">Status</dt><dd><TemplateStatusBadge :template="template" /></dd></div>
        </dl>
        <p class="mt-3 text-sm text-slate-600">{{ info.descricao || 'Sem descrição.' }}</p>
      </section>
      <section class="card">
        <h2 class="mb-3 text-lg font-bold">Resumo da estrutura</h2>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-2xl font-bold text-primary">{{ countCampos(estrutura) }}</p><p class="text-xs text-slate-500">campos</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-2xl font-bold text-primary">{{ countSecoes(estrutura) }}</p><p class="text-xs text-slate-500">seções</p></div>
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-2xl font-bold text-primary">{{ regras.length }}</p><p class="text-xs text-slate-500">regras</p></div>
        </div>
      </section>
      <section class="card">
        <h2 class="mb-3 text-lg font-bold">Validações configuradas</h2>
        <ul class="space-y-2">
          <li v-for="regra in regras" :key="regra.id" class="rounded-lg border border-slate-100 px-3 py-2 text-sm">
            <p class="font-medium">{{ regra.nome }}</p>
            <p class="text-slate-600">{{ describeRegra(regra, campos) }}</p>
          </li>
          <li v-if="!regras.length" class="text-sm text-slate-500">Nenhuma regra ainda. Volte ao passo Regras para adicionar.</li>
        </ul>
      </section>
    </div>
    <aside class="space-y-4">
      <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p class="flex items-start gap-2 font-semibold"><AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" /> Depois de publicar</p>
        <p class="mt-2">Esta versão não poderá ser alterada. Qualquer edição futura gera um rascunho e, na próxima publicação, a versão <strong>{{ nextVersion }}</strong>.</p>
      </div>
      <BaseButton class="w-full" variant="secondary" @click="emit('test')">Testar antes de publicar</BaseButton>
      <BaseButton v-if="!readOnly" class="w-full" :loading="publishing" :disabled="!info.nome" @click="emit('publish')">
        Publicar versão {{ nextVersion }}
      </BaseButton>
    </aside>
  </div>
</template>
