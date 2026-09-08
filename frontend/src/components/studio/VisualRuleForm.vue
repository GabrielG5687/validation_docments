<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { CampoTemplate, RegraValidacao, TipoRegra } from '../../types'
import { FORMAT_PRESETS, formatCurrency, presetFromRegex } from '../../utils/formatPresets'
import { describeRegra } from '../../utils/regraCopy'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{
  campos: CampoTemplate[]
  initial?: Partial<RegraValidacao>
  tipo: TipoRegra
}>()
const emit = defineEmits<{ save: [rule: Partial<RegraValidacao>]; cancel: [] }>()

const form = reactive({
  nome: '',
  campo: '',
  preset: 'cpf',
  regex: FORMAT_PRESETS[0].regex,
  mostrarRegex: false,
  min: 0,
  max: 1000,
  campoResultado: '',
  esquerda: '',
  operador: '*',
  direita: '',
  expressao: '',
  avancado: false,
  tolerancia: 0,
})

watch(() => [props.tipo, props.initial], () => {
  const params = props.initial?.parametros || {}
  form.campo = String(params.campo ?? props.campos[0]?.identificador ?? '')
  form.nome = props.initial?.nome || ''
  const preset = presetFromRegex(String(params.regex ?? ''))
  form.preset = preset?.id || 'personalizado'
  form.regex = String(params.regex ?? FORMAT_PRESETS[0].regex)
  form.mostrarRegex = !preset
  form.min = Number(params.min ?? 0)
  form.max = Number(params.max ?? 1000)
  form.campoResultado = String(params.campo_resultado ?? '') || props.campos[0]?.identificador || ''
  form.expressao = String(params.expressao ?? '')
  form.tolerancia = Number(params.tolerancia ?? 0)
  const simple = form.expressao.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*([+\-*/])\s*([A-Za-z_][A-Za-z0-9_]*)$/)
  form.avancado = Boolean(form.expressao) && !simple
  if (simple) {
    form.esquerda = simple[1]
    form.operador = simple[2]
    form.direita = simple[3]
  } else {
    form.esquerda = props.campos[0]?.identificador ?? ''
    form.direita = props.campos[1]?.identificador ?? props.campos[0]?.identificador ?? ''
  }
}, { immediate: true })

const expressaoFinal = computed(() => form.avancado ? form.expressao : `${form.esquerda} ${form.operador} ${form.direita}`)

const preview = computed(() => {
  const parametros = buildParametros()
  return describeRegra({ tipo: props.tipo, parametros, nome: form.nome }, props.campos)
})

function onPreset(id: string) {
  form.preset = id
  if (id === 'personalizado') {
    form.mostrarRegex = true
    return
  }
  const preset = FORMAT_PRESETS.find((item) => item.id === id)
  if (preset) {
    form.regex = preset.regex
    form.mostrarRegex = false
  }
}

function defaultNome() {
  const campo = props.campos.find((item) => item.identificador === form.campo)?.nome || form.campo
  if (props.tipo === 'campo_obrigatorio') return `${campo} é obrigatório`
  if (props.tipo === 'formato') {
    const preset = FORMAT_PRESETS.find((item) => item.id === form.preset)
    return preset && form.preset !== 'personalizado' ? `${campo} no formato ${preset.label}` : `Formato de ${campo}`
  }
  if (props.tipo === 'intervalo') return `${campo} entre ${form.min} e ${form.max}`
  return 'Conferência de cálculo'
}

function buildParametros(): Record<string, unknown> {
  if (props.tipo === 'campo_obrigatorio') return { campo: form.campo }
  if (props.tipo === 'formato') return { campo: form.campo, regex: form.regex }
  if (props.tipo === 'intervalo') return { campo: form.campo, min: form.min, max: form.max }
  return { expressao: expressaoFinal.value.trim(), campo_resultado: form.campoResultado, tolerancia: form.tolerancia }
}

function save() {
  emit('save', {
    nome: form.nome || defaultNome(),
    tipo: props.tipo,
    parametros: buildParametros(),
    obrigatoria: true,
    ativo: true,
  })
}

const intervaloLabel = computed(() => {
  const campo = props.campos.find((item) => item.identificador === form.campo)
  const fmt = (n: number) => campo?.tipo === 'moeda' ? formatCurrency(n) : String(n)
  return `O valor deve estar entre ${fmt(Number(form.min))} e ${fmt(Number(form.max))}.`
})
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <label v-if="tipo !== 'calculo'" class="block text-sm font-medium text-slate-700">
      Campo
      <select v-model="form.campo" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        <option v-for="campo in campos" :key="campo.id" :value="campo.identificador">{{ campo.nome }}</option>
      </select>
    </label>

    <div v-if="tipo === 'formato'" class="space-y-3">
      <p class="text-sm font-medium text-slate-700">Qual formato deve ser aceito?</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="preset in FORMAT_PRESETS"
          :key="preset.id"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm"
          :class="form.preset === preset.id ? 'border-primary bg-primary-light text-primary' : 'border-slate-200 text-slate-600'"
          @click="onPreset(preset.id)"
        >
          {{ preset.label }}
        </button>
        <button
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm"
          :class="form.preset === 'personalizado' ? 'border-primary bg-primary-light text-primary' : 'border-slate-200 text-slate-600'"
          @click="onPreset('personalizado')"
        >
          Personalizado
        </button>
      </div>
      <label v-if="form.mostrarRegex" class="block text-sm font-medium text-slate-700">
        Expressão (avançado)
        <input v-model="form.regex" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm">
      </label>
    </div>

    <div v-if="tipo === 'intervalo'" class="grid grid-cols-2 gap-3">
      <label class="text-sm font-medium text-slate-700">Valor mínimo<input v-model.number="form.min" type="number" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></label>
      <label class="text-sm font-medium text-slate-700">Valor máximo<input v-model.number="form.max" type="number" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></label>
    </div>

    <div v-if="tipo === 'calculo'" class="space-y-3">
      <label class="block text-sm font-medium text-slate-700">
        Campo que guarda o resultado
        <select v-model="form.campoResultado" class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option v-for="campo in campos" :key="campo.id" :value="campo.identificador">{{ campo.nome }}</option>
        </select>
      </label>
      <div v-if="!form.avancado" class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label class="text-sm font-medium">Campo A
          <select v-model="form.esquerda" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option v-for="campo in campos" :key="campo.id" :value="campo.identificador">{{ campo.nome }}</option>
          </select>
        </label>
        <select v-model="form.operador" class="mb-0.5 rounded-lg border border-slate-300 px-2 py-2 text-sm">
          <option value="+">+</option>
          <option value="-">−</option>
          <option value="*">×</option>
          <option value="/">÷</option>
        </select>
        <label class="text-sm font-medium">Campo B
          <select v-model="form.direita" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option v-for="campo in campos" :key="campo.id" :value="campo.identificador">{{ campo.nome }}</option>
          </select>
        </label>
      </div>
      <label v-else class="block text-sm font-medium">Fórmula<input v-model="form.expressao" class="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"></label>
      <button type="button" class="text-xs font-semibold text-primary" @click="form.avancado = !form.avancado">
        {{ form.avancado ? 'Usar montagem visual' : 'Editar fórmula' }}
      </button>
      <label class="block text-sm font-medium">Margem de diferença aceita<input v-model.number="form.tolerancia" type="number" class="mt-1 w-full rounded-lg border px-3 py-2 text-sm"></label>
    </div>

    <label class="block text-sm font-medium text-slate-700">
      Nome da regra (opcional)
      <input v-model="form.nome" :placeholder="defaultNome()" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
    </label>

    <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {{ tipo === 'intervalo' ? intervaloLabel : preview }}
    </div>

    <div class="flex justify-end gap-2">
      <BaseButton type="button" variant="secondary" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="submit" :disabled="!campos.length">Salvar regra</BaseButton>
    </div>
  </form>
</template>
