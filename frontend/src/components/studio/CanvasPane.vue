<script setup lang="ts">
import type { CampoTemplate, EstruturaTemplate, RegraValidacao } from '../../types'
import { inputTypeFor, placeholderFor } from '../../utils/estrutura'

defineProps<{
  nome: string
  estrutura: EstruturaTemplate
  selectedCampoId?: string
  regras: RegraValidacao[]
}>()

const emit = defineEmits<{
  selectCampo: [secaoId: string, campoId: string]
  selectSecao: [secaoId: string]
}>()

function regrasDoCampo(identificador: string, regras: RegraValidacao[]) {
  return regras.filter((regra) => regra.parametros?.campo === identificador || regra.parametros?.campo_resultado === identificador)
}

function fieldClass(campo: CampoTemplate, selectedCampoId?: string) {
  return [
    'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm',
    selectedCampoId === campo.id ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200',
  ]
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-slate-100">
    <div class="border-b border-slate-200 bg-white px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Pré-visualização</p>
      <p class="text-sm font-semibold text-slate-800">Como o documento vai parecer</p>
    </div>
    <div class="min-h-0 flex-1 overflow-auto p-4 lg:p-8">
      <article class="mx-auto min-h-full max-w-2xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <header class="mb-6 border-b border-slate-100 pb-4">
          <p class="text-xs font-semibold uppercase tracking-widest text-primary">Documento</p>
          <h2 class="mt-1 text-xl font-bold text-slate-900">{{ nome || 'Novo template' }}</h2>
        </header>
        <section v-for="secao in estrutura.secoes" :key="secao.id" class="mb-8">
          <button type="button" class="mb-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-primary" @click="emit('selectSecao', secao.id)">
            {{ secao.nome }}
          </button>
          <div class="space-y-4">
            <label
              v-for="campo in secao.campos"
              :key="campo.id"
              class="block cursor-pointer"
              @click="emit('selectCampo', secao.id, campo.id)"
            >
              <span class="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
                {{ campo.nome }}
                <span v-if="campo.obrigatorio" class="text-red-500">*</span>
              </span>
              <textarea
                v-if="campo.tipo === 'texto_longo'"
                disabled
                rows="3"
                :placeholder="placeholderFor(campo)"
                :class="fieldClass(campo, selectedCampoId)"
              />
              <input
                v-else
                disabled
                :type="inputTypeFor(campo.tipo)"
                :placeholder="placeholderFor(campo)"
                :class="fieldClass(campo, selectedCampoId)"
              >
              <p v-if="campo.descricao" class="mt-1 text-xs text-slate-500">{{ campo.descricao }}</p>
              <p v-if="regrasDoCampo(campo.identificador, regras).length" class="mt-1 text-[11px] text-primary">
                {{ regrasDoCampo(campo.identificador, regras).length }} regra(s) neste campo
              </p>
            </label>
            <p v-if="!secao.campos.length" class="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
              Esta seção ainda não tem campos.
            </p>
          </div>
        </section>
        <p v-if="!estrutura.secoes.length" class="py-16 text-center text-sm text-slate-400">Adicione uma seção à esquerda para começar.</p>
      </article>
    </div>
  </div>
</template>
