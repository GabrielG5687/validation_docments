<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle, TriangleAlert, ShieldAlert, Info } from 'lucide-vue-next'
import type { ValidacaoAssinaturaGov } from '../../types'
import { formatDate } from '../../utils/formatDate'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{
  resultado: ValidacaoAssinaturaGov
  revalidating?: boolean
  canRevalidate?: boolean
}>()

const emit = defineEmits<{ revalidate: [] }>()

const tone = computed(() => {
  switch (props.resultado.status) {
    case 'VALIDA':
      return 'success'
    case 'SEM_ASSINATURA':
      return 'muted'
    case 'DOCUMENTO_ALTERADO':
    case 'NAO_ICP_BRASIL':
    case 'NAO_FOI_POSSIVEL_VALIDAR':
      return 'warning'
    default:
      return 'error'
  }
})

const title = computed(() => {
  switch (props.resultado.status) {
    case 'VALIDA':
      return 'Assinatura válida'
    case 'DOCUMENTO_ALTERADO':
      return 'Assinatura válida, mas documento alterado'
    case 'INVALIDA':
      return 'Assinatura inválida'
    case 'CERTIFICADO_EXPIRADO':
      return 'Certificado expirado'
    case 'CERTIFICADO_REVOGADO':
      return 'Certificado revogado'
    case 'CERTIFICADO_INVALIDO':
      return 'Certificado inválido'
    case 'SEM_ASSINATURA':
      return 'Documento sem assinatura digital'
    case 'NAO_ICP_BRASIL':
      return 'Assinatura digital encontrada (não ICP-Brasil)'
    default:
      return 'Assinatura que não pôde ser validada'
  }
})

function formatDay(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
}

const boxClass = computed(() => {
  if (tone.value === 'success') return 'border-green-200 bg-green-50'
  if (tone.value === 'warning') return 'border-amber-200 bg-amber-50'
  if (tone.value === 'error') return 'border-red-200 bg-red-50'
  return 'border-slate-200 bg-slate-50'
})

const titleClass = computed(() => {
  if (tone.value === 'success') return 'text-green-900'
  if (tone.value === 'warning') return 'text-amber-900'
  if (tone.value === 'error') return 'text-red-900'
  return 'text-slate-800'
})
</script>

<template>
  <section :class="['rounded-xl border p-5', boxClass]">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <CheckCircle v-if="tone === 'success'" class="mt-0.5 h-6 w-6 shrink-0 text-green-700" aria-hidden="true" />
        <TriangleAlert v-else-if="tone === 'warning'" class="mt-0.5 h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
        <ShieldAlert v-else-if="tone === 'error'" class="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden="true" />
        <Info v-else class="mt-0.5 h-6 w-6 shrink-0 text-slate-500" aria-hidden="true" />
        <div>
          <p class="text-lg font-bold" :class="titleClass">{{ tone === 'success' ? '✓ ' : tone === 'muted' ? '' : '⚠ ' }}{{ title }}</p>
          <p class="mt-1 text-sm text-slate-700">{{ resultado.mensagem }}</p>
        </div>
      </div>
      <BaseButton v-if="canRevalidate" variant="secondary" :loading="revalidating" @click="emit('revalidate')">
        Revalidar
      </BaseButton>
    </div>

    <div v-for="(assinatura, index) in resultado.assinaturas" :key="index" class="mt-4 rounded-lg border border-white/80 bg-white/70 p-4 text-sm">
      <dl class="grid gap-2 sm:grid-cols-2">
        <div>
          <dt class="text-slate-500">Assinante</dt>
          <dd class="font-medium text-slate-900">{{ assinatura.assinante }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Data da assinatura</dt>
          <dd class="font-medium text-slate-900">{{ formatDate(assinatura.dataAssinatura) }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Certificado</dt>
          <dd class="font-medium text-slate-900">{{ assinatura.certificado.valido ? 'válido' : 'inválido' }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Emissor</dt>
          <dd class="font-medium text-slate-900">{{ assinatura.certificado.emissor }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Validade do certificado</dt>
          <dd class="font-medium text-slate-900">{{ formatDay(assinatura.certificado.inicioValidade) }} a {{ formatDay(assinatura.certificado.fimValidade) }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Documento</dt>
          <dd class="font-medium text-slate-900">{{ assinatura.documentoIntegro ? 'íntegro' : 'alterado após a assinatura' }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Alterado após assinatura</dt>
          <dd class="font-medium text-slate-900">{{ assinatura.documentoIntegro ? 'Não' : 'Sim' }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">ICP-Brasil / gov.br</dt>
          <dd class="font-medium text-slate-900">{{ assinatura.icpBrasil ? 'Sim' : 'Não identificado' }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Revogação</dt>
          <dd class="font-medium text-slate-900">
            <template v-if="assinatura.certificado.revogado">Revogado</template>
            <template v-else-if="assinatura.certificado.revogacaoVerificada">Não revogado</template>
            <template v-else>Não verificada (CRL indisponível)</template>
          </dd>
        </div>
      </dl>
      <p v-if="assinatura.motivo" class="mt-3 text-sm text-slate-700">{{ assinatura.motivo }}</p>
    </div>

    <p v-if="resultado.observacoes?.length" class="mt-3 text-xs text-slate-500">
      A validação usa a assinatura criptográfica do PDF, não carimbos visuais, QR Code ou texto.
    </p>
  </section>
</template>
