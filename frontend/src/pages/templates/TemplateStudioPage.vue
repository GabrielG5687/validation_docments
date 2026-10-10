<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, History, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import { useTemplateStudio } from '../../composables/useTemplateStudio'
import type { RegraValidacao, StudioStep, TipoRegra } from '../../types'
import StudioStepper from '../../components/studio/StudioStepper.vue'
import StructurePane from '../../components/studio/StructurePane.vue'
import CanvasPane from '../../components/studio/CanvasPane.vue'
import PropertiesPane from '../../components/studio/PropertiesPane.vue'
import RuleTypePicker from '../../components/studio/RuleTypePicker.vue'
import VisualRuleForm from '../../components/studio/VisualRuleForm.vue'
import TestPane from '../../components/studio/TestPane.vue'
import ReviewPane from '../../components/studio/ReviewPane.vue'
import TemplateStatusBadge from '../../components/template/TemplateStatusBadge.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import { describeRegra } from '../../utils/regraCopy'

const STEPS: Array<{ id: StudioStep; label: string }> = [
  { id: 'informacoes', label: 'Informações' },
  { id: 'campos', label: 'Campos' },
  { id: 'regras', label: 'Regras' },
  { id: 'teste', label: 'Teste' },
  { id: 'revisao', label: 'Revisão' },
]

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationStore()
const studio = useTemplateStudio()
const {
  template,
  estrutura,
  regras,
  loading,
  saving,
  publishing,
  savedAt,
  error,
  selected,
  info,
  wasPublished,
  campos,
  selectedSecao,
  selectedCampo,
} = studio
const canEdit = computed(() => auth.podeGerenciarTemplates)

const step = ref<StudioStep>('campos')
const pane = ref<'estrutura' | 'canvas' | 'propriedades'>('canvas')
const ruleTipo = ref<TipoRegra>()
const editingRule = ref<RegraValidacao>()
const showRuleForm = ref(false)

studio.setEditable(canEdit.value)

watch(canEdit, (value) => studio.setEditable(value))

watch(() => route.params.id, (id) => {
  if (id) void studio.load(String(id))
}, { immediate: true })

watch(() => route.query.step, (value) => {
  const next = STEPS.find((item) => item.id === value)
  if (next) step.value = next.id
}, { immediate: true })

onMounted(() => {
  const queryStep = STEPS.find((item) => item.id === route.query.step)
  if (queryStep) step.value = queryStep.id
})

onUnmounted(() => studio.dispose())

const nextVersion = computed(() => {
  const current = template.value?.versaoAtual || '1.0'
  if (!wasPublished.value) return current
  const major = parseInt(current.split('.')[0], 10) || 1
  return `${major + 1}.0`
})

const saveLabel = computed(() => {
  if (saving.value) return 'Salvando…'
  if (savedAt.value) return 'Salvo'
  return ''
})

function go(next: StudioStep) {
  step.value = next
  void router.replace({ query: { ...route.query, step: next } })
}

function openNewRule(tipo: TipoRegra) {
  ruleTipo.value = tipo
  editingRule.value = undefined
  showRuleForm.value = true
}

function openEditRule(regra: RegraValidacao) {
  ruleTipo.value = regra.tipo
  editingRule.value = regra
  showRuleForm.value = true
}

async function saveRule(payload: Partial<RegraValidacao>) {
  await studio.saveRule(payload, editingRule.value?.id)
  showRuleForm.value = false
  editingRule.value = undefined
  notifications.push({ type: 'success', message: 'Regra salva.' })
}

async function removeRule(regra: RegraValidacao) {
  if (!confirm(`Excluir a regra “${regra.nome}”?`)) return
  await studio.removeRule(regra.id)
  notifications.push({ type: 'success', message: 'Regra excluída.' })
}

async function persistIfDirty() {
  if (studio.dirty.value) await studio.persist()
}

async function publish() {
  try {
    await studio.publish()
    notifications.push({ type: 'success', message: `Versão ${template.value?.versaoAtual} publicada.` })
  } catch {
    notifications.push({ type: 'error', message: 'Não foi possível publicar.' })
  }
}

const selectedKind = computed(() => selected.value.kind)
const selectedSecaoId = computed(() => selected.value.kind === 'geral' ? undefined : selected.value.secaoId)
const selectedCampoId = computed(() => selected.value.kind === 'campo' ? selected.value.campoId : undefined)
</script>

<template>
  <div class="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-slate-50">
    <header class="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <button type="button" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Voltar" @click="router.push('/templates')">
        <ArrowLeft class="h-5 w-5" />
      </button>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-lg font-bold text-slate-900">{{ info.nome || 'Novo template' }}</h1>
          <TemplateStatusBadge v-if="template" :template="template" />
          <span class="text-xs font-semibold text-slate-500">v{{ template?.versaoAtual }}</span>
        </div>
        <p class="text-xs text-slate-500">
          <Loader2 v-if="saving" class="mr-1 inline h-3 w-3 animate-spin" />
          {{ saveLabel }}
        </p>
      </div>
      <RouterLink v-if="template" :to="`/templates/${template.id}/versoes`" class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        <History class="h-4 w-4" /> Versões
      </RouterLink>
      <BaseButton v-if="canEdit && step !== 'revisao'" variant="secondary" @click="go('revisao')">Revisar e publicar</BaseButton>
    </header>

    <div class="shrink-0 border-b border-slate-200 bg-white px-4 py-2">
      <StudioStepper :step="step" :steps="STEPS" @update:step="go" />
    </div>

    <div v-if="wasPublished && canEdit && template?.status !== 'ativo'" class="shrink-0 bg-violet-50 px-4 py-2 text-sm text-violet-900">
      Este template já foi publicado. As alterações ficam em rascunho até você publicar a versão {{ nextVersion }}.
    </div>
    <div v-else-if="template?.status === 'ativo' && canEdit" class="shrink-0 bg-sky-50 px-4 py-2 text-sm text-sky-900">
      Template ativo. Qualquer edição cria um rascunho; a versão publicada permanece intacta até a nova publicação.
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <BaseSpinner v-if="loading" />
      <p v-else-if="error" class="p-6 text-sm text-red-700">{{ error }}</p>
      <template v-else-if="template">
        <section v-if="step === 'informacoes'" class="h-full overflow-auto p-4 lg:p-8">
          <div class="mx-auto max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="text-lg font-bold">Informações do template</h2>
            <label class="block text-sm font-medium">Nome
              <input :value="info.nome" :disabled="!canEdit" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" @input="studio.updateInfo({ nome: ($event.target as HTMLInputElement).value })">
            </label>
            <label class="block text-sm font-medium">Tipo
              <input :value="info.categoria" :disabled="!canEdit" placeholder="Nota fiscal, contrato, laudo…" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" @input="studio.updateInfo({ categoria: ($event.target as HTMLInputElement).value })">
            </label>
            <label class="block text-sm font-medium">Descrição
              <textarea :value="info.descricao" :disabled="!canEdit" rows="4" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" @input="studio.updateInfo({ descricao: ($event.target as HTMLTextAreaElement).value })" />
            </label>
            <div class="flex justify-end">
              <BaseButton @click="go('campos')">Continuar para campos</BaseButton>
            </div>
          </div>
        </section>

        <section v-else-if="step === 'campos'" class="flex h-full min-h-0 flex-col">
          <div class="flex shrink-0 gap-1 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
            <button v-for="item in (['estrutura', 'canvas', 'propriedades'] as const)" :key="item" type="button" class="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold" :class="pane === item ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'" @click="pane = item">
              {{ item === 'estrutura' ? 'Estrutura' : item === 'canvas' ? 'Documento' : 'Propriedades' }}
            </button>
          </div>
          <div class="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <div class="min-h-0 overflow-hidden border-r border-slate-200 bg-white" :class="pane === 'estrutura' ? 'block' : 'hidden lg:block'">
              <StructurePane
                :secoes="estrutura.secoes"
                :selected-kind="selectedKind"
                :selected-secao-id="selectedSecaoId"
                :selected-campo-id="selectedCampoId"
                :read-only="!canEdit"
                @select-secao="studio.selectSecao"
                @select-campo="studio.selectCampo"
                @add-secao="studio.addSecao"
                @add-campo="studio.addCampo($event)"
                @add-regra="go('regras')"
                @remove-secao="studio.removeSecao"
                @remove-campo="(secaoId, campoId) => studio.removeCampo(secaoId, campoId)"
                @move-secao="studio.moveSecao"
                @move-campo="studio.moveCampo"
              />
            </div>
            <div class="min-h-0 overflow-hidden" :class="pane === 'canvas' ? 'block' : 'hidden lg:block'">
              <CanvasPane
                :nome="info.nome"
                :estrutura="estrutura"
                :selected-campo-id="selectedCampoId"
                :regras="regras"
                @select-campo="studio.selectCampo"
                @select-secao="studio.selectSecao"
              />
            </div>
            <div class="min-h-0 overflow-hidden border-l border-slate-200 bg-white" :class="pane === 'propriedades' ? 'block' : 'hidden lg:block'">
              <PropertiesPane
                :template="template"
                :info="info"
                :secao="selectedSecao"
                :campo="selectedCampo"
                :kind="selectedKind"
                :read-only="!canEdit"
                @update-info="studio.updateInfo"
                @update-secao="studio.updateSecao(selectedSecaoId || '', $event)"
                @update-campo="studio.updateCampo(selectedSecaoId || '', selectedCampoId || '', $event)"
              />
            </div>
          </div>
        </section>

        <section v-else-if="step === 'regras'" class="h-full overflow-auto p-4 lg:p-6">
          <div class="mx-auto max-w-5xl space-y-6">
            <div>
              <h2 class="text-lg font-bold">Regras de validação</h2>
              <p class="text-sm text-slate-600">Escolha o tipo. A configuração usa linguagem simples — sem código.</p>
            </div>
            <RuleTypePicker v-if="canEdit" :selected="ruleTipo" @select="openNewRule" />
            <div class="grid gap-6 lg:grid-cols-[1fr_380px]">
              <div class="space-y-2">
                <article v-for="regra in regras" :key="regra.id" class="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <p class="font-semibold">{{ regra.nome }}</p>
                    <p class="mt-1 text-sm text-slate-600">{{ describeRegra(regra, campos) }}</p>
                  </div>
                  <div v-if="canEdit" class="flex gap-2">
                    <BaseButton variant="ghost" @click="openEditRule(regra)">Editar</BaseButton>
                    <BaseButton variant="danger" @click="removeRule(regra)">Excluir</BaseButton>
                  </div>
                </article>
                <p v-if="!regras.length" class="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Nenhuma regra ainda. Escolha um tipo acima.</p>
              </div>
              <div v-if="showRuleForm && ruleTipo && canEdit" class="card h-fit">
                <h3 class="mb-3 font-bold">Configurar regra</h3>
                <VisualRuleForm :tipo="ruleTipo" :campos="campos" :initial="editingRule" @save="saveRule" @cancel="showRuleForm = false" />
              </div>
            </div>
            <div class="flex justify-end">
              <BaseButton @click="go('teste')">Testar template</BaseButton>
            </div>
          </div>
        </section>

        <section v-else-if="step === 'teste'" class="flex h-full min-h-0 flex-col overflow-auto p-4 lg:p-6">
          <TestPane :template-id="template.id" :campos="campos" :persist="persistIfDirty" />
        </section>

        <section v-else class="h-full overflow-auto p-4 lg:p-6">
          <ReviewPane
            :template="template"
            :info="info"
            :estrutura="estrutura"
            :campos="campos"
            :regras="regras"
            :publishing="publishing"
            :read-only="!canEdit"
            :next-version="nextVersion"
            @publish="publish"
            @test="go('teste')"
          />
        </section>
      </template>
    </div>
  </div>
</template>
