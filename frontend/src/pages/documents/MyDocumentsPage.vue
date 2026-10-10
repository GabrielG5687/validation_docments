<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDocumentStore } from '../../stores/document'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import ValidadeSeal from '../../components/document/ValidadeSeal.vue'
import { formatDate } from '../../utils/formatDate'

const store = useDocumentStore()
const route = useRoute()
const validade = ref('')
const busca = ref(typeof route.query.q === 'string' ? route.query.q : '')

async function load() {
  const params: Record<string, string> = {}
  if (validade.value) params.validade = validade.value
  if (busca.value.trim()) params.search = busca.value.trim()
  await store.list(Object.keys(params).length ? params : undefined).catch(() => undefined)
}

watch(() => route.query.q, (q) => {
  busca.value = typeof q === 'string' ? q : ''
  void load()
})

onMounted(load)
</script>
<template>
  <div>
    <PageHeader title="Documentos" description="Acompanhe o status, a validade e o que ainda precisa de revisão.">
      <RouterLink to="/documentos/upload"><BaseButton>Enviar documento</BaseButton></RouterLink>
    </PageHeader>
    <div class="mb-4 flex flex-col gap-3 sm:flex-row">
      <input v-model="busca" class="field sm:max-w-sm" placeholder="Buscar por nome do arquivo" aria-label="Buscar documentos" @keyup.enter="load" />
      <select v-model="validade" class="field sm:w-52" aria-label="Filtrar por validade" @change="load">
        <option value="">Todas as validades</option>
        <option value="proximos">Vencendo em breve</option>
        <option value="vencido">Vencidos</option>
        <option value="todos">Com validade</option>
      </select>
      <BaseButton variant="secondary" @click="load">Buscar</BaseButton>
    </div>
    <BaseAlert v-if="store.error" type="error" :message="store.error" />
    <BaseSpinner v-if="store.loading" />
    <div v-else class="surface overflow-x-auto">
      <table class="min-w-full text-left">
        <thead class="bg-canvas">
          <tr>
            <th class="th">Nome</th>
            <th class="th">Modelo</th>
            <th class="th">Enviado em</th>
            <th class="th">Validade</th>
            <th class="th">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="document in store.documentos" :key="document.id" class="hover:bg-canvas/60">
            <td class="td font-medium"><RouterLink :to="`/documentos/${document.id}`" class="hover:text-primary">{{ document.nomeArquivo }}</RouterLink></td>
            <td class="td text-ink-muted">{{ document.template?.nome || '—' }}</td>
            <td class="td text-ink-muted">{{ formatDate(document.criadoEm) }}</td>
            <td class="td"><ValidadeSeal v-if="document.status === 'aprovado'" :status="document.statusValidade" :dias-para-vencer="document.diasParaVencer" /><span v-else class="text-ink-muted">—</span></td>
            <td class="td"><BaseBadge :status="document.status" /></td>
          </tr>
          <tr v-if="!store.documentos.length">
            <td colspan="5" class="px-5 py-12 text-center">
              <p class="font-semibold text-ink">Nenhum documento por aqui</p>
              <p class="mt-1 text-sm text-ink-muted">Envie um PDF para iniciar a validação.</p>
              <RouterLink to="/documentos/upload" class="mt-4 inline-flex"><BaseButton>Enviar documento</BaseButton></RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
