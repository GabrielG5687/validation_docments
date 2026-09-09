<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import GovBrSignatureCard from '../../components/document/GovBrSignatureCard.vue'
import { documentService } from '../../services/documentService'
import type { AnaliseIa } from '../../types'
import { analiseAprovada } from '../../utils/analiseStatus'
import { assinaturaGovFromDados } from '../../utils/assinaturaGov'

const route = useRoute()
const router = useRouter()
const store = useDocumentStore()
const { poll } = useDocument()
const copied = ref(false)
const revalidating = ref(false)

const analiseIa = computed(() => {
  const raw = store.documentoAtual?.dadosExtraidos?._analiseIa
  if (!raw || typeof raw !== 'object') return undefined
  return raw as AnaliseIa
})

const assinaturaGov = computed(() => assinaturaGovFromDados(store.documentoAtual?.dadosExtraidos))

const camposExtraidos = computed(() => {
  const dados = store.documentoAtual?.dadosExtraidos || {}
  return Object.fromEntries(
    Object.entries(dados).filter(([key, value]) => !key.startsWith('_') && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
  )
})
const approved = computed(() => analiseAprovada(store.documentoAtual))

onMounted(async () => {
  try {
    await store.get(String(route.params.id))
    if (store.documentoAtual && ['processando', 'aguardando_validacao'].includes(store.documentoAtual.status)) {
      poll(String(route.params.id), (doc) => { store.documentoAtual = doc })
    }
  } catch {
    await router.push('/documentos')
  }
})

async function copyCode() {
  if (store.documentoAtual?.codigoVerificacao) {
    await navigator.clipboard?.writeText(store.documentoAtual.codigoVerificacao)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
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
    <BaseSpinner v-if="store.loading && !store.documentoAtual" />
    <template v-else-if="store.documentoAtual">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="muted">Detalhes do documento</p>
          <h1 class="page-title">{{ store.documentoAtual.nomeArquivo }}</h1>
        </div>
        <div class="flex items-center gap-4">
          <ApprovalSeal v-if="approved" compact />
          <BaseBadge :status="store.documentoAtual.status" />
        </div>
      </div>
      <div v-if="store.documentoAtual.codigoVerificacao" class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-5">
        <div>
          <p class="text-sm font-medium text-green-800">Código de verificação</p>
          <p class="mt-1 font-mono text-2xl font-bold tracking-wider text-green-900">{{ store.documentoAtual.codigoVerificacao }}</p>
        </div>
        <BaseButton variant="secondary" @click="copyCode">{{ copied ? 'Copiado!' : 'Copiar código' }}</BaseButton>
        <img v-if="store.documentoAtual.qrcodeUrl" :src="store.documentoAtual.qrcodeUrl" alt="QR Code de verificação" class="h-20 w-20" />
      </div>
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-6">
          <section class="card relative overflow-hidden">
            <ApprovalSeal v-if="approved" class="absolute right-6 top-16 z-10" />
            <h2 class="mb-4 text-lg font-bold">Visualização</h2>
            <PdfViewer :url="store.documentoAtual.presignedUrl" />
          </section>
          <section class="card">
            <h2 class="mb-4 text-lg font-bold">Dados extraídos</h2>
            <dl class="grid gap-3 sm:grid-cols-2">
              <template v-for="(value, key) in camposExtraidos" :key="key">
                <dt class="text-sm text-slate-500">{{ key }}</dt>
                <dd class="text-sm font-medium">{{ String(value) }}</dd>
              </template>
              <p v-if="!Object.keys(camposExtraidos).length" class="muted">Dados ainda não disponíveis.</p>
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
            <p class="mt-1 text-sm text-slate-600">Ainda não há resultado criptográfico armazenado para este documento.</p>
            <BaseButton class="mt-3" variant="secondary" :loading="revalidating" @click="revalidateSignature">Validar assinatura</BaseButton>
          </section>
          <section v-if="analiseIa" class="card">
            <h2 class="mb-4 text-lg font-bold">Análise da IA</h2>
            <p v-if="analiseIa.resumo" class="text-sm text-slate-700">{{ analiseIa.resumo }}</p>
            <ul v-if="analiseIa.alertas?.length" class="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
              <li v-for="alerta in analiseIa.alertas" :key="alerta">{{ alerta }}</li>
            </ul>
          </section>
          <section class="card">
            <h2 class="mb-4 text-lg font-bold">Resultados de validação</h2>
            <ValidationResults :results="store.documentoAtual.validacoes?.flatMap((v) => v.resultadosRegra || [])" />
            <div v-for="validation in store.documentoAtual.validacoes || []" :key="validation.id" class="mt-4 border-t pt-4 text-sm">
              <p class="font-semibold">{{ validation.resultado === 'aprovado' ? 'Parecer aprovado' : 'Parecer reprovado' }}</p>
              <p class="mt-1 text-slate-600">{{ validation.observacoes || 'Sem observações' }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatDate(validation.criadoEm) }}</p>
            </div>
          </section>
          <section class="card">
            <h2 class="mb-4 text-lg font-bold">Histórico</h2>
            <DocumentStatusTimeline :history="store.documentoAtual.historico" />
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
