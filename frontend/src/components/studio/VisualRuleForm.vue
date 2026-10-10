<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { CampoTemplate, RegraValidacao, TipoRegra } from '../../types'
import { FORMAT_PRESETS, formatCurrency, presetFromRegex } from '../../utils/formatPresets'
import { describeRegra } from '../../utils/regraCopy'
import { templateService } from '../../services/templateService'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{
  campos: CampoTemplate[]
  initial?: Partial<RegraValidacao>
  tipo: TipoRegra
}>()
const emit = defineEmits<{ save: [rule: Partial<RegraValidacao>]; cancel: [] }>()
const gerando = ref(false)
const erroFormato = ref('')

const form = reactive({
  nome: '',
  campo: '',
  preset: 'cpf',
  regex: FORMAT_PRESETS[0].regex,
  formatoDescricao: '',
  exemploGerado: '',
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
  form.preset = preset?.id || (params.regex ? 'personalizado' : 'cpf')
  form.regex = String(params.regex ?? FORMAT_PRESETS[0].regex)
  form.formatoDescricao = String(params.formatoDescricao ?? '')
  form.exemploGerado = ''
  erroFormato.value = ''
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
  erroFormato.value = ''
  form.exemploGerado = ''
  if (id === 'personalizado') {
    form.regex = ''
    return
  }
  const preset = FORMAT_PRESETS.find((item) => item.id === id)
  if (preset) {
    form.regex = preset.regex
    form.formatoDescricao = ''
  }
}

async function gerarFormato() {
  const descricao = form.formatoDescricao.trim()
  if (descricao.length < 3) {
    erroFormato.value = 'Descreva o formato que deve ser aceito.'
    return
  }
  gerando.value = true
  erroFormato.value = ''
  try {
    const gerado = await templateService.generateRegex(descricao)
    form.regex = gerado.regex
    form.exemploGerado = gerado.exemplo
  } catch (error: unknown) {
    const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
    erroFormato.value = message || 'Não foi possível gerar o formato.'
    form.regex = ''
  } finally {
    gerando.value = false
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
  if (props.tipo === 'formato') {
    return {
      campo: form.campo,
      regex: form.regex,
      ...(form.preset === 'personalizado' && form.formatoDescricao.trim()
        ? { formatoDescricao: form.formatoDescricao.trim() }
        : {}),
    }
  }
  if (props.tipo === 'intervalo') return { campo: form.campo, min: form.min, max: form.max }
  return { expressao: expressaoFinal.value.trim(), campo_resultado: form.campoResultado, tolerancia: form.tolerancia }
}

async function save() {
  if (props.tipo === 'formato' && form.preset === 'personalizado' && !form.regex) {
    await gerarFormato()
    if (!form.regex) return
  }
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
  <form class="space-y-4" @submit.prevent="save()">
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
      <div v-if="form.preset === 'personalizado'" class="space-y-2">
        <label class="block text-sm font-medium text-slate-700" for="formato-personalizado">
          Qual formato deve ser aceito?
          <textarea
            id="formato-personalizado"
            v-model="form.formatoDescricao"
            rows="2"
            placeholder="Ex.: placa Mercosul, três letras, um número, uma letra e dois números"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            @input="form.regex = ''; form.exemploGerado = ''"
          />
        </label>
        <BaseButton type="button" variant="secondary" :loading="gerando" @click="gerarFormato">Gerar formato com IA</BaseButton>
        <p v-if="erroFormato" class="text-sm text-red-700">{{ erroFormato }}</p>
        <p v-else-if="form.regex" class="text-sm text-emerald-800">
          Formato gerado<span v-if="form.exemploGerado">. Exemplo aceito: {{ form.exemploGerado }}</span>.
        </p>
      </div>
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
