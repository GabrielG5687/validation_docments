<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { useDocumentStore } from '../../stores/document'
import { useDocument } from '../../composables/useDocument'
import { formatDate } from '../../utils/formatDate'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import PdfViewer from '../../components/document/PdfViewer.vue'
import ValidationResults from '../../components/document/ValidationResults.vue'
import DocumentStatusTimeline from '../../components/document/DocumentStatusTimeline.vue'
import ApprovalSeal from '../../components/document/ApprovalSeal.vue'
import ValidadeSeal from '../../components/document/ValidadeSeal.vue'
import GovBrSignatureCard from '../../components/document/GovBrSignatureCard.vue'
import EvidenciasExtraidas from '../../components/document/EvidenciasExtraidas.vue'
import ExtractionErrorNotice from '../../components/document/ExtractionErrorNotice.vue'
import { documentService } from '../../services/documentService'
import { useAuthStore } from '../../stores/auth'
import type { ParecerIa, ResumoExtracao } from '../../types'
import { analiseAprovada } from '../../utils/analiseStatus'
import { assinaturaGovFromDados } from '../../utils/assinaturaGov'
import { humanizeLabel } from '../../utils/humanizeLabel'
import { documentoNextStep } from '../../utils/documentoNextStep'

const route = useRoute()
const router = useRouter()
const store = useDocumentStore()
const auth = useAuthStore()
const { poll } = useDocument()
const copied = ref(false)
const revalidating = ref(false)
const reviewing = ref(false)
const observacoes = ref('')
const reviewError = ref('')

const resumoExtracao = computed(() => {
  const raw = store.documentoAtual?.dadosExtraidos?._analiseIa
  if (!raw || typeof raw !== 'object') return undefined
  return raw as ResumoExtracao
})

const parecerIa = computed<ParecerIa | undefined>(() => {
  const validacoes = store.documentoAtual?.validacoes || []
  for (const validacao of validacoes) {
    if (!validacao.parecerIa) continue
    try {
      return JSON.parse(validacao.parecerIa) as ParecerIa
    } catch {
      return undefined
    }
  }
  return undefined
})

function rotuloResultado(resultado: 'aprovado' | 'reprovado' | 'inconclusivo') {
  if (resultado === 'aprovado') return 'Parecer aprovado'
  if (resultado === 'reprovado') return 'Parecer reprovado'
  return 'Parecer inconclusivo'
}

const assinaturaGov = computed(() => assinaturaGovFromDados(store.documentoAtual?.dadosExtraidos))

const erroExtracao = computed(() => store.documentoAtual?.dadosExtraidos?.erroExtracao)

const camposExtraidos = computed(() => {
  const dados = store.documentoAtual?.dadosExtraidos || {}
  return Object.fromEntries(
    Object.entries(dados).filter(([key, value]) => key !== 'erroExtracao' && !key.startsWith('_') && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
  )
})
const approved = computed(() => analiseAprovada(store.documentoAtual))
const podeRevisar = computed(() => {
  const status = store.documentoAtual?.status
  return (status === 'aguardando_revisao' || status === 'em_revisao') && auth.podeRevisar
})
const nextStep = computed(() =>
  store.documentoAtual
    ? documentoNextStep(store.documentoAtual.status, podeRevisar.value)
    : null,
)
const nextStepClass = computed(() => {
  const tone = nextStep.value?.tone
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-950'
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-950'
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-950'
  if (tone === 'info') return 'border-sky-200 bg-sky-50 text-sky-950'
  return 'border-line bg-canvas text-ink'
})
const listaDocumentosPath = computed(() =>
  auth.perfil === 'usuario' && !auth.proprietarioEmpresa ? '/documentos' : '/documentos/todos',
)
const loadError = ref('')
const retrying = ref(false)

async function carregarDocumento() {
  loadError.value = ''
  try {
    await store.get(String(route.params.id))
    if (store.documentoAtual && ['processando', 'aguardando_validacao'].includes(store.documentoAtual.status)) {
      poll(String(route.params.id), (doc) => { store.documentoAtual = doc })
    }
  } catch (e: unknown) {
    loadError.value = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      || 'Não foi possível abrir este documento. Verifique a conexão ou tente novamente.'
  }
}

async function tentarNovamente() {
  retrying.value = true
  try {
    await carregarDocumento()
  } finally {
    retrying.value = false
  }
}

onMounted(carregarDocumento)

async function copyCode() {
  if (store.documentoAtual?.codigoVerificacao) {
    await navigator.clipboard?.writeText(store.documentoAtual.codigoVerificacao)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

async function confirmarRevisao(resultado: 'aprovado' | 'reprovado') {
  const documento = store.documentoAtual
  if (!documento) return
  if (resultado === 'reprovado' && observacoes.value.trim().length < 10) {
    reviewError.value = 'Informe o motivo da reprovação (mínimo 10 caracteres).'
    return
  }
  reviewing.value = true
  reviewError.value = ''
  try {
    if (documento.status === 'aguardando_revisao') {
      await documentService.startReview(documento.id)
    }
    await documentService.finishReview(documento.id, resultado, observacoes.value)
    await store.get(documento.id)
  } catch (e: unknown) {
    reviewError.value = (e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Não foi possível confirmar a revisão.'
  } finally {
    reviewing.value = false
  }
}

async function revalidateSignature() {
  if (!store.documentoAtual) return
  revalidating.value = true
  try {
    const resultado = await documentService.validateSignature(store.documentoAtual.id)
    store.documentoAtual = {
      ...store.documentoAtual,
      dadosExtraidos: { ...(store.documentoAtual.dadosExtraidos || {}), _assinaturaGov: resultado },
    }
  } finally {
    revalidating.value = false
  }
}
</script>

<template>
  <div>
    <BaseSpinner v-if="store.loading && !store.documentoAtual && !loadError" />
    <div v-else-if="loadError" class="card max-w-xl">
      <p class="font-semibold text-ink">Não foi possível abrir o documento</p>
      <p class="mt-2 text-sm text-ink-muted">{{ loadError }}</p>
      <p class="mt-2 text-sm text-ink-muted">
        Se o armazenamento estiver fora do ar, o PDF não abre — você ainda pode voltar à lista e tentar de novo em breve.
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <BaseButton :loading="retrying" @click="tentarNovamente">Tentar novamente</BaseButton>
        <RouterLink :to="listaDocumentosPath" class="inline-flex">
          <BaseButton variant="secondary">Voltar para a lista</BaseButton>
        </RouterLink>
      </div>
    </div>
    <template v-else-if="store.documentoAtual">
      <RouterLink
        :to="listaDocumentosPath"
        class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Voltar aos documentos
      </RouterLink>

      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="muted">{{ store.documentoAtual.template?.nome || 'Documento' }}</p>
          <h1 class="page-title break-all">{{ store.documentoAtual.nomeArquivo }}</h1>
          <p v-if="store.documentoAtual.usuario" class="mt-1 text-sm text-ink-muted">
            Enviado por {{ store.documentoAtual.usuario.nome }}
            <span v-if="store.documentoAtual.usuario.email">· {{ store.documentoAtual.usuario.email }}</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <ApprovalSeal v-if="approved" compact />
          <BaseBadge :status="store.documentoAtual.status" />
          <ValidadeSeal
            v-if="store.documentoAtual.status === 'aprovado' && store.documentoAtual.statusValidade"
            :status="store.documentoAtual.statusValidade"
            :dias-para-vencer="store.documentoAtual.diasParaVencer"
            :data-validade="store.documentoAtual.dataValidade"
          />
        </div>
      </div>

      <section v-if="nextStep" class="mb-6 rounded-xl border p-4" :class="nextStepClass" aria-live="polite">
        <p class="text-sm font-semibold">{{ nextStep.title }}</p>
        <p class="mt-1 text-sm opacity-90">{{ nextStep.body }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <RouterLink
            v-if="podeRevisar"
            :to="`/validacao/${store.documentoAtual.id}`"
            class="inline-flex rounded-lg bg-white/80 px-3 py-1.5 text-sm font-semibold text-ink ring-1 ring-black/5 hover:bg-white"
          >
            Abrir workspace de revisão
          </RouterLink>
          <RouterLink
            v-else-if="auth.perfil === 'usuario' && ['reprovado', 'reprovado_automatico', 'erro_extracao'].includes(store.documentoAtual.status)"
            to="/documentos/upload"
            class="inline-flex rounded-lg bg-white/80 px-3 py-1.5 text-sm font-semibold text-ink ring-1 ring-black/5 hover:bg-white"
          >
            Enviar nova versão
          </RouterLink>
        </div>
      </section>

      <div v-if="store.documentoAtual.codigoVerificacao" class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-5">
        <div>
          <p class="text-sm font-medium text-green-800">Código de verificação</p>
          <p class="mt-1 font-mono text-2xl font-bold tracking-wider text-green-900">{{ store.documentoAtual.codigoVerificacao }}</p>
          <p class="mt-1 text-xs text-green-800/80">Compartilhe este código ou o QR Code para comprovar a validade.</p>
        </div>
        <BaseButton variant="secondary" @click="copyCode">{{ copied ? 'Copiado!' : 'Copiar código' }}</BaseButton>
        <img v-if="store.documentoAtual.qrcodeUrl" :src="store.documentoAtual.qrcodeUrl" alt="QR Code de verificação" class="h-20 w-20" />
      </div>

      <section v-if="podeRevisar" class="card mb-6">
        <h2 class="text-base font-semibold text-ink">Registrar parecer</h2>
        <p class="mt-1 text-sm text-ink-muted">Confirme se o documento está conforme. Para reprovar, descreva o motivo (mínimo 10 caracteres).</p>
        <textarea
          id="observacoes-revisao"
          v-model="observacoes"
          rows="3"
          class="mt-4 w-full rounded-lg border border-line bg-white p-3 text-sm text-ink"
          placeholder="Observações do parecer"
        />
        <p v-if="reviewError" class="mt-3 text-sm text-red-700">{{ reviewError }}</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <BaseButton :loading="reviewing" @click="confirmarRevisao('aprovado')">Aprovar documento</BaseButton>
          <BaseButton variant="danger" :loading="reviewing" @click="confirmarRevisao('reprovado')">Reprovar</BaseButton>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-6">
          <section class="card relative overflow-hidden">
            <ApprovalSeal v-if="approved" class="absolute right-6 top-16 z-10" />
            <h2 class="mb-4 text-lg font-semibold">PDF enviado</h2>
            <PdfViewer :url="store.documentoAtual.presignedUrl" />
          </section>
          <section class="card">
            <h2 class="mb-4 text-lg font-semibold">Informações lidas do documento</h2>
            <ExtractionErrorNotice v-if="erroExtracao" :error="erroExtracao" />
            <dl class="grid gap-3 sm:grid-cols-2">
              <template v-for="(value, key) in camposExtraidos" :key="key">
                <div class="rounded-lg bg-canvas px-3 py-2">
                  <dt class="text-xs font-medium uppercase tracking-wide text-ink-muted">{{ humanizeLabel(String(key)) }}</dt>
                  <dd class="mt-0.5 text-sm font-medium text-ink">{{ String(value) }}</dd>
                </div>
              </template>
              <p v-if="!Object.keys(camposExtraidos).length" class="muted sm:col-span-2">Dados ainda não disponíveis.</p>
            </dl>
          </section>
        </div>
        <div class="space-y-6">
          <GovBrSignatureCard
            v-if="assinaturaGov"
            :resultado="assinaturaGov"
            :revalidating="revalidating"
            can-revalidate
            @revalidate="revalidateSignature"
          />
          <section v-else-if="store.documentoAtual.status !== 'processando'" class="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p class="text-sm font-semibold text-slate-800">Assinatura digital gov.br</p>
            <p class="mt-1 text-sm text-slate-600">Ainda não há resultado de assinatura armazenado para este documento.</p>
            <BaseButton class="mt-3" variant="secondary" :loading="revalidating" @click="revalidateSignature">Validar assinatura</BaseButton>
          </section>
          <EvidenciasExtraidas :dados="store.documentoAtual.dadosExtraidos" />
          <section v-if="resumoExtracao?.resumo" class="card">
            <h2 class="mb-4 text-lg font-semibold">Resumo da leitura</h2>
            <p class="text-sm text-slate-700">{{ resumoExtracao.resumo }}</p>
          </section>
          <section v-if="parecerIa" class="card">
            <h2 class="mb-4 text-lg font-semibold">Parecer da IA</h2>
            <p v-if="parecerIa.analise" class="text-sm text-slate-700">{{ parecerIa.analise }}</p>
            <ul v-if="parecerIa.pendencias?.length" class="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
              <li v-for="pendencia in parecerIa.pendencias" :key="pendencia">{{ pendencia }}</li>
            </ul>
            <p v-if="parecerIa.conclusao" class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{{ parecerIa.conclusao }}</p>
          </section>
          <section class="card">
            <h2 class="mb-4 text-lg font-semibold">Checagem das regras</h2>
            <ValidationResults :results="store.documentoAtual.validacoes?.flatMap((v) => v.resultadosRegra || [])" />
            <div v-for="validation in store.documentoAtual.validacoes || []" :key="validation.id" class="mt-4 border-t pt-4 text-sm">
              <p class="font-semibold">{{ rotuloResultado(validation.resultado) }}</p>
              <p class="mt-1 text-slate-600">{{ validation.observacoes || 'Sem observações' }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatDate(validation.criadoEm) }}</p>
            </div>
          </section>
          <section class="card">
            <h2 class="mb-4 text-lg font-semibold">Histórico</h2>
            <DocumentStatusTimeline :history="store.documentoAtual.historico" />
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
