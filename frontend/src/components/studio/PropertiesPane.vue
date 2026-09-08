<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CampoTemplate, SecaoTemplate, Template } from '../../types'
import { isIdentificadorValido, slugifyIdentificador, TIPOS_CAMPO } from '../../utils/estrutura'
import TemplateStatusBadge from '../template/TemplateStatusBadge.vue'

const props = defineProps<{
  template: Template | null
  info: { nome: string; descricao: string; categoria: string }
  secao?: SecaoTemplate
  campo?: CampoTemplate
  kind: 'geral' | 'secao' | 'campo'
  readOnly?: boolean
}>()

const emit = defineEmits<{
  updateInfo: [patch: Partial<{ nome: string; descricao: string; categoria: string }>]
  updateSecao: [nome: string]
  updateCampo: [patch: Partial<CampoTemplate>]
}>()

const tab = ref<'campo' | 'secao' | 'geral'>('geral')
const identificadorManual = ref(false)

watch(() => props.kind, (kind) => {
  tab.value = kind === 'campo' ? 'campo' : kind === 'secao' ? 'secao' : 'geral'
}, { immediate: true })

watch(() => props.campo?.id, () => {
  identificadorManual.value = false
})

const identificadorErro = computed(() => {
  if (!props.campo) return ''
  return isIdentificadorValido(props.campo.identificador) ? '' : 'Use letras, números e _ (sem espaços).'
})

function onNomeCampo(value: string) {
  const patch: Partial<CampoTemplate> = { nome: value }
  if (!identificadorManual.value) patch.identificador = slugifyIdentificador(value)
  emit('updateCampo', patch)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="border-b border-slate-200 px-4 pt-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Propriedades</p>
      <div class="mt-2 flex gap-1">
        <button
          v-for="item in (['campo', 'secao', 'geral'] as const)"
          :key="item"
          type="button"
          class="rounded-t-lg px-3 py-2 text-sm font-medium"
          :class="tab === item ? 'bg-slate-50 text-primary' : 'text-slate-500 hover:text-slate-800'"
          @click="tab = item"
        >
          {{ item === 'campo' ? 'Campo' : item === 'secao' ? 'Seção' : 'Geral' }}
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
      <div v-if="tab === 'geral'" class="space-y-3">
        <label class="block text-sm font-medium text-slate-700">
          Nome do template
          <input :value="info.nome" :disabled="readOnly" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @input="emit('updateInfo', { nome: ($event.target as HTMLInputElement).value })">
        </label>
        <label class="block text-sm font-medium text-slate-700">
          Tipo / categoria
          <input :value="info.categoria" :disabled="readOnly" placeholder="Ex.: Nota fiscal" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @input="emit('updateInfo', { categoria: ($event.target as HTMLInputElement).value })">
        </label>
        <label class="block text-sm font-medium text-slate-700">
          Descrição
          <textarea :value="info.descricao" :disabled="readOnly" rows="4" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @input="emit('updateInfo', { descricao: ($event.target as HTMLTextAreaElement).value })" />
        </label>
        <div v-if="template" class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <span class="text-slate-500">Versão</span>
          <span class="font-semibold">v{{ template.versaoAtual }}</span>
        </div>
        <TemplateStatusBadge v-if="template" :template="template" />
      </div>

      <div v-else-if="tab === 'secao'" class="space-y-3">
        <p v-if="!secao" class="text-sm text-slate-500">Selecione uma seção na estrutura.</p>
        <label v-else class="block text-sm font-medium text-slate-700">
          Nome da seção
          <input :value="secao.nome" :disabled="readOnly" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @input="emit('updateSecao', ($event.target as HTMLInputElement).value)">
        </label>
        <p v-if="secao" class="text-xs text-slate-500">{{ secao.campos.length }} campo(s) nesta seção.</p>
      </div>

      <div v-else class="space-y-3">
        <p v-if="!campo" class="text-sm text-slate-500">Clique em um campo no documento para editar.</p>
        <template v-else>
          <label class="block text-sm font-medium text-slate-700">
            Nome do campo
            <input :value="campo.nome" :disabled="readOnly" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @input="onNomeCampo(($event.target as HTMLInputElement).value)">
          </label>
          <label class="block text-sm font-medium text-slate-700">
            Identificador
            <input
              :value="campo.identificador"
              :disabled="readOnly"
              class="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm"
              :class="identificadorErro ? 'border-red-400' : 'border-slate-300'"
              @input="identificadorManual = true; emit('updateCampo', { identificador: ($event.target as HTMLInputElement).value })"
            >
            <span v-if="identificadorErro" class="mt-1 block text-xs text-red-600">{{ identificadorErro }}</span>
            <span v-else class="mt-1 block text-xs text-slate-500">Usado nas regras. Sem espaços.</span>
          </label>
          <label class="block text-sm font-medium text-slate-700">
            Tipo
            <select :value="campo.tipo" :disabled="readOnly" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @change="emit('updateCampo', { tipo: ($event.target as HTMLSelectElement).value as CampoTemplate['tipo'] })">
              <option v-for="tipo in TIPOS_CAMPO" :key="tipo.value" :value="tipo.value">{{ tipo.label }}</option>
            </select>
          </label>
          <label class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium">
            Obrigatório
            <input type="checkbox" class="h-4 w-4" :checked="campo.obrigatorio" :disabled="readOnly" @change="emit('updateCampo', { obrigatorio: ($event.target as HTMLInputElement).checked })">
          </label>
          <label class="block text-sm font-medium text-slate-700">
            Descrição
            <textarea :value="campo.descricao" :disabled="readOnly" rows="2" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @input="emit('updateCampo', { descricao: ($event.target as HTMLTextAreaElement).value })" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            Valor padrão
            <input :value="campo.valorPadrao" :disabled="readOnly" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" @input="emit('updateCampo', { valorPadrao: ($event.target as HTMLInputElement).value })">
          </label>
        </template>
      </div>
    </div>
  </div>
</template>
