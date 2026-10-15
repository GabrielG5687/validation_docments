<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTemplateStore } from '../../stores/template'
import { useDocumentStore } from '../../stores/document'
import { useNotificationStore } from '../../stores/notification'
import FileDropzone from './FileDropzone.vue'
import UploadProgress from './UploadProgress.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseAlert from '../ui/BaseAlert.vue'

const templates = useTemplateStore()
const documents = useDocumentStore()
const notice = useNotificationStore()
const router = useRouter()

const step = ref(1)
const templateId = ref('')
const file = ref<File>()
const error = ref('')
const progress = ref(0)
const sending = ref(false)
const sugerindo = ref(false)
const sugestao = ref<{ tipoDocumento: string; confianca: number; templateExistenteId?: string; templateExistenteNome?: string; razao: string; sugerirNovoTemplate: boolean } | null>(null)

const canContinue = computed(() => step.value === 1 ? !!templateId.value : !!file.value)
const selectableTemplates = computed(() => templates.templates.filter((template) => template.status !== 'inativo'))

templates.list().catch(() => { error.value = 'Não foi possível carregar os templates.' })

function selectFile(value: File) {
  file.value = value
  error.value = ''
  sugestao.value = null
}

async function analisarComIa() {
  if (!file.value) return
  sugerindo.value = true
  error.value = ''
  try {
    const resultado = await documents.suggestTemplate(file.value)
    sugestao.value = resultado.sugestao
    // Auto-selecionar template se houver match com alta confiança
    if (resultado.sugestao.templateExistenteId && resultado.sugestao.confianca > 0.8) {
      templateId.value = resultado.sugestao.templateExistenteId
      step.value = 2
      notice.push({ type: 'success', message: `Template "${resultado.sugestao.templateExistenteNome}" selecionado automaticamente (${Math.round(resultado.sugestao.confianca * 100)}% confiança)` })
    }
  } catch (e: any) {
    const msg = e.response?.data?.error || 'Não foi possível analisar o documento.'
    error.value = msg
  } finally {
    sugerindo.value = false
  }
}

function usarTemplateSugerido() {
  if (sugestao.value?.templateExistenteId) {
    templateId.value = sugestao.value.templateExistenteId
    step.value = 2
  }
}

async function send() {
  if (!file.value || !templateId.value) return
  sending.value = true
  try {
    const result = await documents.upload(file.value, templateId.value, (value) => progress.value = value)
    notice.push({ type: 'success', message: 'Documento enviado com sucesso.' })
    router.push(`/documentos/${result.id}`)
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Falha ao enviar o documento.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="card max-w-2xl">
    <div class="mb-8 flex items-center justify-between">
      <div v-for="item in [1, 2, 3]" :key="item" class="flex items-center gap-2 text-sm" :class="step >= item ? 'font-semibold text-primary' : 'text-slate-400'">
        <span class="flex h-8 w-8 items-center justify-center rounded-full border" :class="step >= item ? 'border-primary bg-primary text-white' : 'border-slate-300'">{{ item }}</span>
        <span class="hidden sm:inline">{{ ['Template', 'Arquivo', 'Confirmar'][item - 1] }}</span>
      </div>
    </div>

    <BaseAlert v-if="error" type="error" :message="error" class="mb-4" />

    <div v-if="step === 1" class="space-y-4">
      <h2 class="text-lg font-bold">Escolha um template</h2>
      <select v-model="templateId" class="w-full rounded-lg border border-slate-300 px-3 py-2" aria-label="Template">
        <option value="">Selecione…</option>
        <option v-for="template in selectableTemplates" :key="template.id" :value="template.id">{{ template.nome }} · {{ template.status === 'ativo' ? `v${template.versaoAtual}` : 'rascunho' }}</option>
      </select>
      <p v-if="!templates.loading && !selectableTemplates.length" class="text-sm text-amber-700">Nenhum template disponível. Crie ou gere um em Templates.</p>

      <div v-if="file && !templateId" class="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p class="text-sm font-medium text-blue-900 mb-2">🤖 IA pode sugerir o template ideal para este arquivo</p>
        <BaseButton variant="primary" :loading="sugerindo" @click="analisarComIa" class="w-full sm:w-auto">
          Analisar documento e sugerir template
        </BaseButton>
      </div>
    </div>

    <div v-else-if="step === 2" class="space-y-4">
      <h2 class="text-lg font-bold">Selecione o arquivo</h2>
      <FileDropzone @select="selectFile" @error="error = $event" />
      <p v-if="file" class="text-sm text-green-700">Selecionado: {{ file.name }}</p>

      <!-- Mostrar sugestão da IA se houver -->
      <div v-if="sugestao && !templateId" class="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
        <p class="text-sm font-medium text-emerald-900">✨ Sugestão da IA</p>
        <p class="text-sm text-emerald-800 mt-1"><strong>Tipo detectado:</strong> {{ sugestao.tipoDocumento }} ({{ Math.round(sugestao.confianca * 100) }}% confiança)</p>
        <p class="text-sm text-emerald-800"><strong>Motivo:</strong> {{ sugestao.razao }}</p>
        <template v-if="sugestao.templateExistenteId">
          <p class="text-sm text-emerald-800"><strong>Template recomendado:</strong> {{ sugestao.templateExistenteNome }}</p>
          <BaseButton variant="success" @click="usarTemplateSugerido" class="mt-2 w-full sm:w-auto">Usar este template</BaseButton>
        </template>
        <template v-else>
          <p class="text-sm text-amber-800">Nenhum template existente compatível. <router-link to="/templates/novo" class="underline">Criar novo template</router-link> com IA.</p>
        </template>
      </div>

      <div v-if="sugestao && templateId" class="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <p class="text-sm font-medium text-slate-900">Template selecionado: <strong>{{ templates.templates.find((t) => t.id === templateId)?.nome }}</strong></p>
        <p v-if="sugestao.templateExistenteId && sugestao.templateExistenteId !== templateId" class="text-sm text-amber-800 mt-1">⚠️ A IA sugeria: {{ sugestao.templateExistenteNome }}</p>
      </div>
    </div>

    <div v-else class="space-y-4">
      <h2 class="text-lg font-bold">Confirme o envio</h2>
      <dl class="rounded-lg bg-slate-50 p-4 text-sm">
        <div class="flex justify-between"><dt>Template</dt><dd class="font-semibold">{{ templates.templates.find((t) => t.id === templateId)?.nome }}</dd></div>
        <div class="mt-2 flex justify-between"><dt>Arquivo</dt><dd class="font-semibold">{{ file?.name }}</dd></div>
      </dl>
      <UploadProgress v-if="sending" :progress="progress" />
    </div>

    <div class="mt-8 flex justify-between">
      <BaseButton v-if="step > 1" variant="secondary" @click="step--">Voltar</BaseButton>
      <span v-else />
      <BaseButton v-if="step < 3" :disabled="!canContinue" @click="step++">Continuar</BaseButton>
      <BaseButton v-else :loading="sending" @click="send">Enviar documento</BaseButton>
    </div>
  </div>
</template>