<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTemplateStore } from '../../stores/template'
import { useDocumentStore } from '../../stores/document'
import { documentService } from '../../services/documentService'
import { analiseAprovada, analisePendente, analiseReprovada } from '../../utils/analiseStatus'
import type { Documento, ResumoExtracao } from '../../types'
import FileDropzone from '../upload/FileDropzone.vue'
import UploadProgress from '../upload/UploadProgress.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseAlert from '../ui/BaseAlert.vue'
import BaseSpinner from '../ui/BaseSpinner.vue'
import ValidationResults from '../document/ValidationResults.vue'
import ApprovalSeal from '../document/ApprovalSeal.vue'
import GovBrSignatureCard from '../document/GovBrSignatureCard.vue'
import { assinaturaGovFromDados } from '../../utils/assinaturaGov'

const templates = useTemplateStore()
const documents = useDocumentStore()
const templateId = ref('')
const file = ref<File>()
const error = ref('')
const progress = ref(0)
const sending = ref(false)
const analyzing = ref(false)
const result = ref<Documento>()
let timer: number | undefined

const canSend = computed(() => !!templateId.value && !!file.value && !sending.value && !analyzing.value)
const approved = computed(() => analiseAprovada(result.value))
const rejected = computed(() => analiseReprovada(result.value))
const resumoExtracao = computed(() => {
  const raw = result.value?.dadosExtraidos?._analiseIa
  if (!raw || typeof raw !== 'object') return undefined
  return raw as ResumoExtracao
})
const assinaturaGov = computed(() => assinaturaGovFromDados(result.value?.dadosExtraidos))

const selectableTemplates = computed(() =>
  templates.templates.filter((template) => template.status !== 'inativo')
)

onMounted(() => {
  templates.list().catch(() => {
    error.value = 'Não foi possível carregar os templates.'
  })
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
  if (!file.value || !templateId.value) return
  sending.value = true
  error.value = ''
  result.value = undefined
  try {
    const uploaded = await documents.upload(file.value, templateId.value, (value) => { progress.value = value })
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
  <section class="card">
    <div class="mb-4">
      <h2 class="text-lg font-bold">Analisar documento</h2>
      <p class="muted mt-1">Envie um PDF, a plataforma aplica o template e a IA. Se estiver conforme, o selo OK aparece aqui.</p>
    </div>
    <BaseAlert v-if="error" type="error" :message="error" class="mb-4" />
    <div class="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <form class="space-y-4" @submit.prevent="send">
        <label class="block text-sm font-medium text-slate-700">
          Template
          <select v-model="templateId" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Template">
            <option value="">Selecione…</option>
            <option v-for="template in selectableTemplates" :key="template.id" :value="template.id">
              {{ template.nome }} · {{ template.status === 'ativo' ? `v${template.versaoAtual}` : 'rascunho' }}
            </option>
          </select>
        </label>
        <p v-if="!templates.loading && !selectableTemplates.length" class="text-sm text-amber-700">
          Nenhum template disponível. Crie ou gere um em Templates.
        </p>
        <FileDropzone @select="selectFile" @error="error = $event" />
        <p v-if="file" class="text-sm text-green-700">Selecionado: {{ file.name }}</p>
        <UploadProgress v-if="sending" :progress="progress" />
        <BaseButton type="submit" :loading="sending || analyzing" :disabled="!canSend">Enviar e analisar</BaseButton>
      </form>
      <div class="relative min-h-[16rem] rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
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
          <GovBrSignatureCard v-if="assinaturaGov" :resultado="assinaturaGov" />
          <div v-if="resumoExtracao?.resumo" class="text-sm">
            <p><span class="font-semibold">Extração:</span> {{ resumoExtracao.resumo }}</p>
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
      </div>
    </div>
  </section>
</template>
