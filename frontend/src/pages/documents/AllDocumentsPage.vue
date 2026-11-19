<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useDocumentStore } from '../../stores/document'
import { formatDate } from '../../utils/formatDate'
import BaseBadge from '../../components/ui/BaseBadge.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import ValidadeSeal from '../../components/document/ValidadeSeal.vue'
import {
  STATUS_FILTER_OPTIONS,
  documentoNextStepHint,
  statusMatchesGroup,
  type StatusFilterGroup,
} from '../../utils/documentoNextStep'

const store = useDocumentStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const validade = ref('')
const statusGroup = ref<StatusFilterGroup>('')

const documentosFiltrados = computed(() =>
  store.documentos.filter((doc) => statusMatchesGroup(doc.status, statusGroup.value)),
)

const filtrosComContagem = computed(() =>
  STATUS_FILTER_OPTIONS.map((opt) => ({
    ...opt,
    count: store.documentos.filter((doc) => statusMatchesGroup(doc.status, opt.value)).length,
  })),
)

async function load() {
  const params: Record<string, string> = {}
  if (search.value) params.search = search.value
  if (validade.value) params.validade = validade.value
  await store.list(Object.keys(params).length ? params : undefined)
}

function abrirDocumento(id: string) {
  router.push(`/documentos/${id}`)
}

watch(() => route.query.q, (q) => {
  search.value = typeof q === 'string' ? q : ''
  void load()
})

onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      title="Documentos"
      description="Todos os envios da organização. Use os filtros para achar o que ainda precisa de ação."
    />

    <div class="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por situação">
      <button
        v-for="opt in filtrosComContagem"
        :key="opt.value || 'todos'"
        type="button"
        role="tab"
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
        :class="statusGroup === opt.value ? 'bg-primary text-white' : 'bg-white text-ink-muted ring-1 ring-line hover:bg-canvas hover:text-ink'"
        :aria-selected="statusGroup === opt.value"
        @click="statusGroup = opt.value"
      >
        {{ opt.label }}
        <span
          class="ml-1 tabular-nums opacity-80"
          :class="statusGroup === opt.value ? 'text-white/90' : 'text-ink-muted'"
        >{{ opt.count }}</span>
      </button>
    </div>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row">
      <input
        id="document-search"
        v-model="search"
        class="field sm:max-w-sm"
        placeholder="Buscar documento ou usuário"
        aria-label="Buscar documento ou usuário"
        @keyup.enter="load"
      />
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
            <th class="th">Próximo passo</th>
            <th class="th">Validade</th>
            <th class="th">Enviado em</th>
            <th class="th"><span class="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="document in documentosFiltrados"
            :key="document.id"
            class="cursor-pointer hover:bg-canvas/60"
            tabindex="0"
            @click="abrirDocumento(document.id)"
            @keyup.enter="abrirDocumento(document.id)"
          >
            <td class="td">
              <span class="block max-w-[16rem] truncate font-medium text-ink sm:max-w-xs" :title="document.nomeArquivo">
                {{ document.nomeArquivo }}
              </span>
              <div class="truncate text-xs text-ink-muted">{{ document.template?.nome || 'Sem modelo' }}</div>
            </td>
            <td class="td text-ink-muted">{{ document.usuario?.nome || '—' }}</td>
            <td class="td"><BaseBadge :status="document.status" /></td>
            <td class="td text-sm text-ink-muted">
              {{ documentoNextStepHint(document.status, auth.podeRevisar) }}
            </td>
            <td class="td">
              <ValidadeSeal
                v-if="document.status === 'aprovado'"
                :status="document.statusValidade"
                :dias-para-vencer="document.diasParaVencer"
              />
              <span v-else class="text-ink-muted">—</span>
            </td>
            <td class="td whitespace-nowrap text-ink-muted">{{ formatDate(document.criadoEm) }}</td>
            <td class="td text-ink-muted">
              <ChevronRight class="h-4 w-4" aria-hidden="true" />
            </td>
          </tr>
          <tr v-if="!documentosFiltrados.length">
            <td colspan="7" class="px-5 py-12 text-center">
              <p class="font-semibold text-ink">
                {{ store.documentos.length ? 'Nenhum documento neste filtro' : 'Nenhum documento encontrado' }}
              </p>
              <p class="mt-1 text-sm text-ink-muted">
                {{ store.documentos.length ? 'Tente outro filtro ou limpe a busca.' : 'Quando houver envios, eles aparecem aqui.' }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
