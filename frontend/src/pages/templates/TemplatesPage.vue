<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, Search, Sparkles } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useTemplateStore } from '../../stores/template'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import { templateService } from '../../services/templateService'
import TemplateCard from '../../components/template/TemplateCard.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import FileDropzone from '../../components/upload/FileDropzone.vue'
import type { StatusTemplate, Template } from '../../types'
import { templateBadge } from '../../utils/templateStatus'

const store = useTemplateStore()
const auth = useAuthStore()
const notifications = useNotificationStore()
const router = useRouter()

const open = ref(false)
const openAi = ref(false)
const name = ref('')
const description = ref('')
const categoria = ref('')
const aiName = ref('')
const aiFile = ref<File>()
const saving = ref(false)
const generating = ref(false)
const aiError = ref('')
const search = ref('')
const filter = ref<'todos' | StatusTemplate | 'revisao'>('todos')

onMounted(() => store.list())

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return store.templates.filter((template) => {
    const badge = templateBadge(template)
    const statusOk = filter.value === 'todos'
      || (filter.value === 'revisao' && badge.key === 'revisao')
      || template.status === filter.value
    const text = `${template.nome} ${template.descricao || ''} ${template.categoria || ''}`.toLowerCase()
    return statusOk && (!q || text.includes(q))
  })
})

const filters: Array<{ id: typeof filter.value; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'ativo', label: 'Ativo' },
  { id: 'rascunho', label: 'Rascunho' },
  { id: 'revisao', label: 'Em revisão' },
  { id: 'inativo', label: 'Desativado' },
]

async function create() {
  if (!name.value) return
  saving.value = true
  try {
    const template = await store.create({ nome: name.value, descricao: description.value, categoria: categoria.value || undefined })
    open.value = false
    name.value = ''
    description.value = ''
    categoria.value = ''
    notifications.push({ type: 'success', message: 'Template criado. Monte os campos no editor.' })
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
    const template = await templateService.generateWithAi(aiFile.value, aiName.value)
    openAi.value = false
    aiName.value = ''
    aiFile.value = undefined
    notifications.push({ type: 'success', message: 'Template gerado. Revise campos e regras antes de publicar.' })
    await router.push(`/templates/${template.id}?step=campos`)
  } catch (error: unknown) {
    const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
    aiError.value = message || 'Não foi possível gerar o template com IA.'
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="muted">Biblioteca</p>
        <h1 class="page-title">Templates</h1>
      </div>
      <div v-if="auth.perfil === 'admin'" class="flex flex-wrap gap-2">
        <BaseButton variant="secondary" @click="openAi = true">
          <Sparkles class="h-4 w-4" /> Gerar com IA
        </BaseButton>
        <BaseButton @click="open = true">
          <Plus class="h-4 w-4" /> Novo template
        </BaseButton>
      </div>
    </div>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <label class="relative min-w-0 flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input v-model="search" placeholder="Buscar por nome ou tipo" class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm">
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="item in filters"
          :key="item.id"
          type="button"
          class="rounded-full px-3 py-1.5 text-sm font-medium"
          :class="filter === item.id ? 'bg-primary text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'"
          @click="filter = item.id"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <TemplateCard v-for="template in filtered" :key="template.id" :template="template" />
      <p v-if="!store.loading && !filtered.length" class="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Nenhum template encontrado.
      </p>
    </div>

    <BaseModal :open="open" title="Novo template" @close="open = false">
      <form class="space-y-4" @submit.prevent="create">
        <BaseInput id="template-name" v-model="name" label="Nome" placeholder="Nota Fiscal Eletrônica (NF-e)" />
        <BaseInput id="template-categoria" v-model="categoria" label="Tipo" placeholder="Nota fiscal, contrato…" />
        <BaseInput id="template-description" v-model="description" label="Descrição" />
        <BaseButton type="submit" :loading="saving">Criar e abrir editor</BaseButton>
      </form>
    </BaseModal>
    <BaseModal :open="openAi" title="Gerar template com IA" @close="openAi = false">
      <form class="space-y-4" @submit.prevent="generateWithAi">
        <p class="text-sm text-slate-600">Envie um PDF de exemplo. A IA sugere nome, campos e regras.</p>
        <BaseInput id="ai-template-name" v-model="aiName" label="Nome (opcional)" />
        <FileDropzone @select="aiFile = $event; aiError = ''" @error="aiError = $event" />
        <p v-if="aiFile" class="text-sm text-green-700">Selecionado: {{ aiFile.name }}</p>
        <p v-if="aiError" class="text-sm text-red-700">{{ aiError }}</p>
        <BaseButton type="submit" :loading="generating">Gerar template</BaseButton>
      </form>
    </BaseModal>
  </div>
</template>
