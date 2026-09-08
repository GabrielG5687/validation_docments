<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { documentService } from '../../services/documentService'
import { analiseAprovada, analisePendente, analiseReprovada } from '../../utils/analiseStatus'
import type { AnaliseIa, CampoTemplate, Documento } from '../../types'
import FileDropzone from '../upload/FileDropzone.vue'
import UploadProgress from '../upload/UploadProgress.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseSpinner from '../ui/BaseSpinner.vue'
import ValidationResults from '../document/ValidationResults.vue'
import ApprovalSeal from '../document/ApprovalSeal.vue'

const props = defineProps<{
  templateId: string
  campos: CampoTemplate[]
  persist?: () => Promise<void>
}>()

const file = ref<File>()
const error = ref('')
const progress = ref(0)
const sending = ref(false)
const analyzing = ref(false)
const result = ref<Documento>()
let timer: number | undefined

const canSend = computed(() => !!file.value && !!props.templateId && !sending.value && !analyzing.value)
const approved = computed(() => analiseAprovada(result.value))
const rejected = computed(() => analiseReprovada(result.value))
const analiseIa = computed(() => {
  const raw = result.value?.dadosExtraidos?._analiseIa
  if (!raw || typeof raw !== 'object') return undefined
  return raw as AnaliseIa
})
const extractedFields = computed(() => {
  const dados = result.value?.dadosExtraidos
  if (!dados) return []
  return props.campos
    .map((campo) => {
      const value = dados[campo.identificador]
      return { nome: campo.nome, valor: typeof value === 'string' ? value : '' }
    })
    .filter((item) => item.valor)
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})

function selectFile(value: File) {
  file.value = value
  error.value = ''
  result.value = undefined
}

async function waitAnalysis(id: string) {
  analyzing.value = true
  const tick = async () => {
    const doc = await documentService.get(id)
    result.value = doc
    if (!analisePendente(doc)) {
      if (timer) window.clearInterval(timer)
      timer = undefined
      analyzing.value = false
    }
  }
  await tick()
  if (analisePendente(result.value)) {
    timer = window.setInterval(() => { void tick() }, 2000)
  }
}

async function send() {
  if (!file.value || !props.templateId) return
  sending.value = true
  error.value = ''
  result.value = undefined
  try {
    if (props.persist) await props.persist()
    const uploaded = await documentService.upload(file.value, props.templateId, (value) => { progress.value = value })
    sending.value = false
    await waitAnalysis(uploaded.id)
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Falha ao enviar o documento.'
    sending.value = false
    analyzing.value = false
  }
}
</script>

<template>
  <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
    <section class="card space-y-4">
      <div>
        <h2 class="text-lg font-bold">Analisar documento</h2>
        <p class="muted mt-1">Envie um PDF. A plataforma aplica este template e a IA — o mesmo fluxo do dashboard.</p>
      </div>
      <BaseAlert v-if="error" type="error" :message="error" />
      <FileDropzone @select="selectFile" @error="error = $event" />
      <p v-if="file" class="text-sm text-green-700">Selecionado: {{ file.name }}</p>
      <UploadProgress v-if="sending" :progress="progress" />
      <BaseButton :loading="sending || analyzing" :disabled="!canSend" @click="send">Enviar e analisar</BaseButton>
      <div v-if="extractedFields.length" class="space-y-2 border-t border-slate-100 pt-4">
        <p class="text-sm font-semibold text-slate-800">Campos extraídos</p>
        <div v-for="item in extractedFields" :key="item.nome" class="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <p class="text-xs font-medium text-slate-500">{{ item.nome }}</p>
          <p class="text-slate-800">{{ item.valor }}</p>
        </div>
      </div>
    </section>
    <section class="relative min-h-[16rem] overflow-auto rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
      <div v-if="sending || analyzing" class="flex h-full flex-col items-center justify-center gap-3 py-10">
        <BaseSpinner />
        <p class="text-sm font-medium text-slate-700">{{ sending ? 'Enviando arquivo…' : 'Analisando documento…' }}</p>
      </div>
      <div v-else-if="result" class="space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-900">{{ result.nomeArquivo }}</p>
            <p class="muted">{{ result.template?.nome }}</p>
          </div>
          <ApprovalSeal v-if="approved" compact />
        </div>
        <p v-if="approved" class="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">Documento conforme. Selo OK aplicado.</p>
        <p v-else-if="rejected" class="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">Documento reprovado na análise automática.</p>
        <p v-else class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Análise em andamento ou aguardando revisão humana.</p>
        <div v-if="analiseIa" class="text-sm">
          <p v-if="analiseIa.resumo"><span class="font-semibold">IA:</span> {{ analiseIa.resumo }}</p>
          <ul v-if="analiseIa.alertas?.length" class="mt-2 list-disc pl-5 text-amber-800">
            <li v-for="alerta in analiseIa.alertas" :key="alerta">{{ alerta }}</li>
          </ul>
        </div>
        <ValidationResults :results="result.validacoes?.flatMap((item) => item.resultadosRegra || [])" />
        <RouterLink :to="`/documentos/${result.id}`" class="inline-block text-sm font-semibold text-primary">Ver detalhes</RouterLink>
      </div>
      <p v-else class="flex h-full items-center justify-center py-10 text-center text-sm text-slate-500">
        O resultado da análise aparece aqui.
      </p>
      <div v-if="approved && result" class="pointer-events-none absolute bottom-4 right-4">
        <ApprovalSeal />
      </div>
    </section>
  </div>
</template>
