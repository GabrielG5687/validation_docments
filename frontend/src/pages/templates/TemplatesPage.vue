<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTemplateStore } from '../../stores/template'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import { templateService } from '../../services/templateService'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import RowMenu from '../../components/ui/RowMenu.vue'
import FileDropzone from '../../components/upload/FileDropzone.vue'
import TemplateStatusBadge from '../../components/template/TemplateStatusBadge.vue'
import type { StatusTemplate, Template } from '../../types'
import { templateBadge } from '../../utils/templateStatus'

const store = useTemplateStore()
const auth = useAuthStore()
const notifications = useNotificationStore()
const router = useRouter()
const route = useRoute()

const open = ref(false)
const openAi = ref(false)
const name = ref('')
const description = ref('')
const categoria = ref('')
const aiName = ref('')
const aiDescription = ref('')
const aiCategoria = ref('')
const aiFile = ref<File>()
const saving = ref(false)
const generating = ref(false)
const aiError = ref('')
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const filter = ref<'todos' | StatusTemplate | 'revisao'>('todos')
const categoriaFiltro = ref('')

onMounted(() => store.list())

const categorias = computed(() => {
  const set = new Set(store.templates.map((template) => template.categoria).filter(Boolean) as string[])
  return [...set]
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return store.templates.filter((template) => {
    const badge = templateBadge(template)
    const statusOk = filter.value === 'todos'
      || (filter.value === 'revisao' && badge.key === 'revisao')
      || template.status === filter.value
    const categoriaOk = !categoriaFiltro.value || template.categoria === categoriaFiltro.value
    const text = `${template.nome} ${template.descricao || ''} ${template.categoria || ''}`.toLowerCase()
    return statusOk && categoriaOk && (!q || text.includes(q))
  })
})

const filters: Array<{ id: typeof filter.value; label: string }> = [
  { id: 'todos', label: 'Todos os status' },
  { id: 'ativo', label: 'Ativo' },
  { id: 'rascunho', label: 'Rascunho' },
  { id: 'revisao', label: 'Em revisão' },
  { id: 'inativo', label: 'Desativado' },
]

async function create() {
  if (!name.value.trim()) return
  saving.value = true
  try {
    const template = await store.create({ nome: name.value.trim(), descricao: description.value, categoria: categoria.value || undefined })
    open.value = false
    name.value = ''
    description.value = ''
    categoria.value = ''
    notifications.push({ type: 'success', message: 'Modelo criado. Monte os campos no editor.' })
    await router.push(`/templates/${(template as Template).id}?step=informacoes`)
  } catch {
    // interceptor
  } finally {
    saving.value = false
  }
}

async function generateWithAi() {
  if (!aiFile.value) {
    aiError.value = 'Envie um PDF de exemplo.'
    return
  }
  generating.value = true
  aiError.value = ''
  try {
    const template = await templateService.generateWithAi(aiFile.value, aiName.value, aiDescription.value)
    openAi.value = false
    aiName.value = ''
    aiDescription.value = ''
    aiCategoria.value = ''
    aiFile.value = undefined
    notifications.push({ type: 'success', message: 'Modelo gerado. Revise campos e regras antes de publicar.' })
    await router.push(`/templates/${template.id}?step=campos`)
  } catch (error: unknown) {
    const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
    aiError.value = message || 'Não foi possível gerar o modelo com IA.'
  } finally {
    generating.value = false
  }
}

watch(() => route.query.q, (q) => {
  if (typeof q === 'string') search.value = q
})
</script>

<template>
  <div>
    <PageHeader title="Modelos" description="Biblioteca de documentos da organização, com versão e estado de publicação.">
      <template v-if="auth.podeGerenciarTemplates">
        <BaseButton variant="secondary" @click="openAi = true">Gerar com IA</BaseButton>
        <BaseButton @click="open = true">+ Novo modelo</BaseButton>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row">
      <input v-model="search" class="field lg:max-w-sm" placeholder="Buscar modelos" aria-label="Buscar modelos" />
      <select v-model="categoriaFiltro" class="field lg:w-52" aria-label="Filtrar por categoria">
        <option value="">Todas as categorias</option>
        <option v-for="item in categorias" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="filter" class="field lg:w-48" aria-label="Filtrar por status">
        <option v-for="item in filters" :key="item.id" :value="item.id">{{ item.label }}</option>
      </select>
    </div>

    <BaseSpinner v-if="store.loading" />
    <div v-else class="surface overflow-x-auto">
      <table class="min-w-full text-left">
        <thead class="bg-canvas">
          <tr>
            <th class="th">Nome</th>
            <th class="th">Categoria</th>
            <th class="th">Versão</th>
            <th class="th">Status</th>
            <th class="th text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="template in filtered" :key="template.id" class="hover:bg-canvas/60">
            <td class="td">
              <RouterLink :to="`/templates/${template.id}`" class="font-medium text-ink hover:text-primary">{{ template.nome }}</RouterLink>
              <p v-if="template.descricao" class="max-w-md truncate text-xs text-ink-muted">{{ template.descricao }}</p>
            </td>
            <td class="td text-ink-muted">{{ template.categoria || '—' }}</td>
            <td class="td text-ink-muted">v{{ template.versaoAtual }}</td>
            <td class="td"><TemplateStatusBadge :template="template" /></td>
            <td class="td text-right">
              <RowMenu>
                <RouterLink class="menu-item" :to="`/templates/${template.id}`">Abrir editor</RouterLink>
                <RouterLink class="menu-item" :to="`/templates/${template.id}/versoes`">Histórico de versões</RouterLink>
              </RowMenu>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="5" class="px-5 py-12 text-center">
              <p class="font-semibold text-ink">Nenhum modelo encontrado</p>
              <p class="mt-1 text-sm text-ink-muted">Crie um modelo manualmente ou gere as regras a partir de um PDF.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <BaseModal :open="open" title="Novo modelo" description="Depois você monta os campos e as regras no editor." @close="open = false">
      <form class="space-y-3" @submit.prevent="create">
        <BaseInput id="template-name" v-model="name" label="Nome do modelo" placeholder="Contrato de Prestação de Serviços" />
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink" for="template-categoria">Categoria</label>
          <select id="template-categoria" v-model="categoria" class="field">
            <option value="">Selecione uma categoria</option>
            <option>Societário</option>
            <option>Jurídico</option>
            <option>Documentos Pessoais</option>
            <option>Fiscal</option>
            <option>LGPD</option>
          </select>
        </div>
        <BaseInput id="template-description" v-model="description" label="Descrição (opcional)" placeholder="Descreva o propósito deste modelo" />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
          <BaseButton type="submit" :loading="saving">Criar modelo</BaseButton>
        </div>
      </form>
    </BaseModal>

    <BaseModal :open="openAi" title="Gerar modelo com IA" description="Descreva o documento que deseja gerar e envie um PDF de exemplo." @close="openAi = false">
      <form class="space-y-3" @submit.prevent="generateWithAi">
        <BaseInput id="ai-template-name" v-model="aiName" label="Nome (opcional)" placeholder="Ex.: Contrato de prestação de serviços" />
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink" for="ai-template-description">Descrição e requisitos do modelo (opcional)</label>
          <textarea id="ai-template-description" v-model="aiDescription" rows="3" class="field" placeholder="Descreva a finalidade do documento e os requisitos que devem ser verificados." />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink" for="ai-categoria">Categoria</label>
          <select id="ai-categoria" v-model="aiCategoria" class="field">
            <option value="">Selecione uma categoria</option>
            <option>Societário</option>
            <option>Jurídico</option>
            <option>Documentos Pessoais</option>
            <option>Fiscal</option>
            <option>LGPD</option>
          </select>
        </div>
        <FileDropzone @select="aiFile = $event; aiError = ''" @error="aiError = $event" />
        <p v-if="aiFile" class="text-sm text-emerald-700">Selecionado: {{ aiFile.name }}</p>
        <p v-if="aiError" class="text-sm text-red-700">{{ aiError }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" @click="openAi = false">Cancelar</BaseButton>
          <BaseButton type="submit" :loading="generating">Gerar</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
