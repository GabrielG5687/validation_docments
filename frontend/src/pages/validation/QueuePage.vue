<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Search } from 'lucide-vue-next'
import { documentService } from '../../services/documentService'
import type { Documento } from '../../types'
import { formatDate } from '../../utils/formatDate'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import PageHeader from '../../components/ui/PageHeader.vue'

const documents = ref<Documento[]>([])
const loading = ref(true)
const error = ref('')
const busca = ref('')

const filtrados = computed(() => {
  const q = busca.value.trim().toLowerCase()
  if (!q) return documents.value
  return documents.value.filter((doc) => {
    const hay = `${doc.nomeArquivo} ${doc.template?.nome || ''} ${doc.usuario?.nome || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

onMounted(async () => {
  try {
    documents.value = (await documentService.pending()).data
  } catch {
    error.value = 'Não foi possível carregar a fila. Tente novamente em instantes.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader
      title="Fila de revisão"
      :description="loading
        ? 'Carregando documentos que precisam do seu parecer…'
        : documents.length
          ? `${documents.length} documento${documents.length === 1 ? '' : 's'} aguardando decisão humana.`
          : 'Quando a análise automática terminar com pendências, os envios aparecem aqui.'"
    />

    <div v-if="!loading && documents.length" class="mb-4">
      <label class="relative block sm:max-w-sm">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        <input
          v-model="busca"
          class="field pl-9"
          placeholder="Buscar por arquivo, modelo ou pessoa"
          aria-label="Buscar na fila de revisão"
        />
      </label>
    </div>

    <p v-if="error" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</p>
    <BaseSpinner v-if="loading" />

    <div v-else class="surface overflow-x-auto">
      <table class="min-w-full text-left">
        <thead class="bg-canvas">
          <tr>
            <th class="th">Documento</th>
            <th class="th">Enviado por</th>
            <th class="th">Status</th>
            <th class="th">Enviado em</th>
            <th class="th"><span class="sr-only">Ação</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="document in filtrados" :key="document.id" class="hover:bg-canvas/60">
            <td class="td">
              <p class="max-w-md truncate font-medium text-ink" :title="document.nomeArquivo">{{ document.nomeArquivo }}</p>
              <p class="text-xs text-ink-muted">{{ document.template?.nome || 'Sem modelo' }}</p>
            </td>
            <td class="td text-ink-muted">{{ document.usuario?.nome || '—' }}</td>
            <td class="td"><BaseBadge :status="document.status" /></td>
            <td class="td whitespace-nowrap text-ink-muted">{{ formatDate(document.criadoEm) }}</td>
            <td class="td text-right">
              <RouterLink
                :to="`/validacao/${document.id}`"
                class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Revisar
                <ArrowRight class="h-4 w-4" aria-hidden="true" />
              </RouterLink>
            </td>
          </tr>
          <tr v-if="!filtrados.length">
            <td colspan="5" class="px-5 py-12 text-center">
              <p class="font-semibold text-ink">
                {{ documents.length ? 'Nenhum item corresponde à busca' : 'Fila vazia por enquanto' }}
              </p>
              <p class="mt-1 text-sm text-ink-muted">
                {{ documents.length
                  ? 'Tente outro termo ou limpe a busca.'
                  : 'Você será avisado quando houver documentos para decidir.' }}
              </p>
              <RouterLink v-if="!documents.length" to="/documentos/todos" class="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
                Ver todos os documentos
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
