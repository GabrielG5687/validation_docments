<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDocumentStore } from '../../stores/document'
import { formatDate } from '../../utils/formatDate'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import ValidadeSeal from '../../components/document/ValidadeSeal.vue'

const store = useDocumentStore()
const route = useRoute()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const validade = ref('')

async function load() {
  const params: Record<string, string> = {}
  if (search.value) params.search = search.value
  if (validade.value) params.validade = validade.value
  await store.list(Object.keys(params).length ? params : undefined)
}

watch(() => route.query.q, (q) => {
  search.value = typeof q === 'string' ? q : ''
  void load()
})

onMounted(load)
</script>
<template>
  <div>
    <PageHeader title="Documentos" description="Todos os envios da organização, com status e validade." />
    <div class="mb-4 flex flex-col gap-3 sm:flex-row">
      <input id="document-search" v-model="search" class="field sm:max-w-sm" placeholder="Buscar documento ou usuário" aria-label="Buscar documento ou usuário" @keyup.enter="load" />
      <select v-model="validade" class="field sm:w-52" aria-label="Filtrar por validade" @change="load">
        <option value="">Todas as validades</option>
        <option value="proximos">Vencendo em breve</option>
        <option value="vencido">Vencidos</option>
        <option value="todos">Com validade</option>
      </select>
      <BaseButton variant="secondary" @click="load">Buscar</BaseButton>
    </div>
    <BaseSpinner v-if="store.loading" />
    <div v-else class="surface overflow-x-auto">
      <table class="min-w-full text-left">
        <thead class="bg-canvas">
          <tr>
            <th class="th">Arquivo</th>
            <th class="th">Usuário</th>
            <th class="th">Status</th>
            <th class="th">Validade</th>
            <th class="th">Enviado em</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="document in store.documentos" :key="document.id" class="hover:bg-canvas/60">
            <td class="td">
              <RouterLink :to="`/documentos/${document.id}`" class="font-medium text-ink hover:text-primary">{{ document.nomeArquivo }}</RouterLink>
              <div class="text-xs text-ink-muted">{{ document.template?.nome }}</div>
            </td>
            <td class="td text-ink-muted">{{ document.usuario?.nome || '—' }}</td>
            <td class="td"><BaseBadge :status="document.status" /></td>
            <td class="td"><ValidadeSeal :status="document.statusValidade" :dias-para-vencer="document.diasParaVencer" /></td>
            <td class="td text-ink-muted">{{ formatDate(document.criadoEm) }}</td>
          </tr>
          <tr v-if="!store.documentos.length">
            <td colspan="5" class="px-5 py-12 text-center text-sm text-ink-muted">Nenhum documento encontrado.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
