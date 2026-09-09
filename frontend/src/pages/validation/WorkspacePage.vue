<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentService } from '../../services/documentService'
import type { Documento } from '../../types'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'
import PdfViewer from '../../components/document/PdfViewer.vue'
import ValidationResults from '../../components/document/ValidationResults.vue'
import GovBrSignatureCard from '../../components/document/GovBrSignatureCard.vue'
import { assinaturaGovFromDados } from '../../utils/assinaturaGov'

const route = useRoute()
const router = useRouter()
const document = ref<Documento>()
const observations = ref('')
const error = ref('')
const loading = ref(true)
let finalized = false

const assinaturaGov = computed(() => assinaturaGovFromDados(document.value?.dadosExtraidos))
const camposExtraidos = computed(() => {
  const dados = document.value?.dadosExtraidos || {}
  return Object.fromEntries(
    Object.entries(dados).filter(([key, value]) => !key.startsWith('_') && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
  )
})

onMounted(async () => {
  try {
    document.value = await documentService.get(String(route.params.id))
    await documentService.startReview(String(route.params.id))
    document.value.status = 'em_revisao'
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Não foi possível iniciar a revisão.'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (!finalized && document.value?.status === 'em_revisao') {
    documentService.cancelReview(String(route.params.id)).catch(() => undefined)
  }
})

async function finish(result: 'aprovado' | 'reprovado') {
  if (result === 'reprovado' && observations.value.trim().length < 10) {
    error.value = 'Informe o motivo da reprovação (mínimo 10 caracteres).'
    return
  }
  try {
    document.value = await documentService.finishReview(String(route.params.id), result, observations.value)
    finalized = true
    router.push(`/documentos/${route.params.id}`)
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Não foi possível finalizar a revisão.'
  }
}
</script>

<template>
  <div>
    <h1 class="page-title mb-6">Workspace de revisão</h1>
    <BaseAlert v-if="error" type="error" :message="error" class="mb-5" />
    <div v-if="loading" class="card">Carregando documento…</div>
    <div v-else-if="document" class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-5">
        <PdfViewer :url="document.presignedUrl" />
        <section class="card">
          <h2 class="mb-3 font-bold">Dados extraídos</h2>
          <dl class="grid grid-cols-2 gap-2 text-sm">
            <template v-for="(value, key) in camposExtraidos" :key="key">
              <dt class="text-slate-500">{{ key }}</dt>
              <dd>{{ String(value) }}</dd>
            </template>
          </dl>
        </section>
      </div>
      <div class="space-y-5">
        <GovBrSignatureCard v-if="assinaturaGov" :resultado="assinaturaGov" />
        <section class="card">
          <h2 class="mb-3 font-bold">Validação automática</h2>
          <ValidationResults :results="document.validacoes?.flatMap((v) => v.resultadosRegra || [])" />
        </section>
        <section class="card">
          <label for="observacoes" class="mb-2 block font-semibold">Observações do parecer</label>
          <textarea id="observacoes" v-model="observations" rows="5" class="w-full rounded-lg border border-slate-300 p-3" placeholder="Descreva o parecer ou o motivo da reprovação." />
          <div class="mt-4 flex gap-3">
            <BaseButton @click="finish('aprovado')">Aprovar documento</BaseButton>
            <BaseButton variant="danger" @click="finish('reprovado')">Reprovar</BaseButton>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
