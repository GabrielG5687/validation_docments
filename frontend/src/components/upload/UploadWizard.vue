<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
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
const sugestao = ref<{
  tipoDocumento: string
  confianca: number
  templateExistenteId?: string
  templateExistenteNome?: string
  razao: string
  sugerirNovoTemplate: boolean
} | null>(null)

const steps = [
  { n: 1, label: 'Arquivo' },
  { n: 2, label: 'Modelo' },
  { n: 3, label: 'Confirmar' },
]

const canContinue = computed(() => (step.value === 1 ? !!file.value : !!templateId.value))
const selectableTemplates = computed(() => templates.templates.filter((template) => template.status !== 'inativo'))
const modeloSelecionado = computed(() => templates.templates.find((t) => t.id === templateId.value))

templates.list().catch(() => {
  error.value = 'Não foi possível carregar os modelos disponíveis.'
})

function selectFile(value: File) {
  file.value = value
  error.value = ''
  sugestao.value = null
  templateId.value = ''
}

async function analisarComIa() {
  if (!file.value) return
  sugerindo.value = true
  error.value = ''
  try {
    const resultado = await documents.suggestTemplate(file.value)
    sugestao.value = resultado.sugestao
    if (resultado.sugestao.templateExistenteId && resultado.sugestao.confianca > 0.8) {
      templateId.value = resultado.sugestao.templateExistenteId
      notice.push({
        type: 'success',
        message: `Modelo “${resultado.sugestao.templateExistenteNome}” sugerido (${Math.round(resultado.sugestao.confianca * 100)}% de confiança)`,
      })
    }
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      || 'Não foi possível analisar o documento para sugerir um modelo.'
    error.value = msg
  } finally {
    sugerindo.value = false
  }
}

function usarModeloSugerido() {
  if (sugestao.value?.templateExistenteId) {
    templateId.value = sugestao.value.templateExistenteId
  }
}

async function send() {
  if (!file.value || !templateId.value) return
  sending.value = true
  try {
    const result = await documents.upload(file.value, templateId.value, (value) => { progress.value = value })
    notice.push({ type: 'success', message: 'Documento enviado. Acompanhe a análise na próxima tela.' })
    router.push(`/documentos/${result.id}`)
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Falha ao enviar o documento.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="card max-w-2xl">
    <ol class="mb-8 flex items-center justify-between gap-2" aria-label="Etapas do envio">
      <li
        v-for="item in steps"
        :key="item.n"
        class="flex flex-1 items-center gap-2 text-sm"
        :class="step >= item.n ? 'font-semibold text-primary' : 'text-ink-muted'"
      >
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm"
          :class="step >= item.n ? 'border-primary bg-primary text-white' : 'border-line bg-white'"
          aria-hidden="true"
        >{{ item.n }}</span>
        <span class="hidden sm:inline">{{ item.label }}</span>
      </li>
    </ol>

    <BaseAlert v-if="error" type="error" :message="error" class="mb-4" />

    <div v-if="step === 1" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-ink">Selecione o PDF</h2>
        <p class="mt-1 text-sm text-ink-muted">Comece pelo arquivo. Depois escolhemos o modelo de validação.</p>
      </div>
      <FileDropzone @select="selectFile" @error="error = $event" />
      <p v-if="file" class="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
        Arquivo pronto: {{ file.name }}
      </p>
    </div>

    <div v-else-if="step === 2" class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-ink">Escolha o modelo</h2>
        <p class="mt-1 text-sm text-ink-muted">
          O modelo define quais regras a plataforma aplica neste tipo de documento.
        </p>
      </div>

      <div class="rounded-xl border border-primary/20 bg-primary-light/50 p-4">
        <p class="text-sm font-medium text-ink">Não sabe qual modelo usar?</p>
        <p class="mt-1 text-sm text-ink-muted">Podemos analisar o PDF e sugerir o mais adequado.</p>
        <BaseButton class="mt-3" variant="secondary" :loading="sugerindo" @click="analisarComIa">
          <Sparkles class="h-4 w-4" aria-hidden="true" />
          Sugerir modelo com IA
        </BaseButton>
      </div>

      <div v-if="sugestao" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p class="text-sm font-semibold text-emerald-900">Sugestão da IA</p>
        <p class="mt-1 text-sm text-emerald-900">
          Tipo detectado: <strong>{{ sugestao.tipoDocumento }}</strong>
          ({{ Math.round(sugestao.confianca * 100) }}% de confiança)
        </p>
        <p class="mt-1 text-sm text-emerald-800">{{ sugestao.razao }}</p>
        <template v-if="sugestao.templateExistenteId">
          <p class="mt-2 text-sm text-emerald-900">
            Modelo recomendado: <strong>{{ sugestao.templateExistenteNome }}</strong>
          </p>
          <BaseButton class="mt-3" variant="success" @click="usarModeloSugerido">Usar este modelo</BaseButton>
        </template>
        <p v-else class="mt-2 text-sm text-amber-900">
          Nenhum modelo existente parece compatível. Peça a um administrador para criar um modelo em Modelos.
        </p>
      </div>

      <label class="block text-sm font-medium text-ink">
        Modelo de validação
        <select v-model="templateId" class="field mt-1.5" aria-label="Modelo de validação">
          <option value="">Selecione um modelo…</option>
          <option v-for="template in selectableTemplates" :key="template.id" :value="template.id">
            {{ template.nome }} · {{ template.status === 'ativo' ? `v${template.versaoAtual}` : 'rascunho' }}
          </option>
        </select>
      </label>
      <p v-if="!templates.loading && !selectableTemplates.length" class="text-sm text-amber-800">
        Nenhum modelo disponível. Peça a um administrador da organização para publicar um modelo.
      </p>
      <p v-if="file" class="text-sm text-ink-muted">Arquivo: {{ file.name }}</p>
    </div>

    <div v-else class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-ink">Confirme o envio</h2>
        <p class="mt-1 text-sm text-ink-muted">Revise os dados antes de iniciar a análise.</p>
      </div>
      <dl class="space-y-3 rounded-xl bg-canvas p-4 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-ink-muted">Arquivo</dt>
          <dd class="max-w-[60%] truncate text-right font-semibold text-ink">{{ file?.name }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-ink-muted">Modelo</dt>
          <dd class="text-right font-semibold text-ink">{{ modeloSelecionado?.nome }}</dd>
        </div>
      </dl>
      <UploadProgress v-if="sending" :progress="progress" />
    </div>

    <div class="mt-8 flex justify-between gap-3">
      <BaseButton v-if="step > 1" variant="secondary" :disabled="sending" @click="step--">Voltar</BaseButton>
      <span v-else />
      <BaseButton v-if="step < 3" :disabled="!canContinue" @click="step++">Continuar</BaseButton>
      <BaseButton v-else :loading="sending" @click="send">Enviar documento</BaseButton>
    </div>
  </div>
</template>
