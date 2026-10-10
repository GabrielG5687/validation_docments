<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { entidadeService } from '../../services/entidadeService'
import { useTemplateStore } from '../../stores/template'
import { useNotificationStore } from '../../stores/notification'
import type { ConformidadeEntidade, Dossie, DossieItem, Entidade } from '../../types'
import { formatDate } from '../../utils/formatDate'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import RowMenu from '../../components/ui/RowMenu.vue'
import DossieStatusBadge from '../../components/entidades/DossieStatusBadge.vue'
import ValidadeSeal from '../../components/document/ValidadeSeal.vue'

const route = useRoute()
const templateStore = useTemplateStore()
const notice = useNotificationStore()

const entidade = ref<Entidade | null>(null)
const conformidade = ref<ConformidadeEntidade | null>(null)
const dossies = ref<Dossie[]>([])
const loading = ref(true)
const salvando = ref(false)

const modalDossie = ref(false)
const dossieForm = ref({ nome: '', descricao: '' })
const templatesSelecionados = ref<Record<string, boolean>>({})
const obrigatorios = ref<Record<string, boolean>>({})

const itensObrigatorios = ref(0)
const itensAtendidos = ref(0)
const itensVencidos = ref(0)

const activeTemplates = computed(() => templateStore.templates.filter((t) => t.status !== 'rascunho'))

async function load() {
  loading.value = true
  const id = route.params.id as string
  try {
    const [ent, conf, doss] = await Promise.all([
      entidadeService.get(id),
      entidadeService.conformidade(id).catch(() => null),
      entidadeService.listDossies(id),
    ])
    entidade.value = ent
    conformidade.value = conf
    dossies.value = doss
    itensObrigatorios.value = conf?.obrigatorios ?? 0
    itensAtendidos.value = conf?.atendidos ?? 0
    itensVencidos.value = conf?.vencidos ?? 0
  } catch {
    notice.push({ type: 'error', message: 'Não foi possível carregar a entidade.' })
  } finally {
    loading.value = false
  }
}

function abrirNovoDossie() {
  dossieForm.value = { nome: '', descricao: '' }
  templatesSelecionados.value = {}
  obrigatorios.value = {}
  modalDossie.value = true
}

async function criarDossie() {
  if (!dossieForm.value.nome.trim()) {
    notice.push({ type: 'warning', message: 'Informe o nome do dossiê.' })
    return
  }
  const itens = Object.entries(templatesSelecionados.value)
    .filter(([, v]) => v)
    .map(([templateId]) => ({ templateId, obrigatorio: obrigatorios.value[templateId] !== false }))
  if (!itens.length) {
    notice.push({ type: 'warning', message: 'Selecione ao menos um template para o dossiê.' })
    return
  }
  salvando.value = true
  try {
    await entidadeService.createDossie({
      entidadeId: entidade.value!.id,
      nome: dossieForm.value.nome.trim(),
      descricao: dossieForm.value.descricao.trim() || undefined,
      itens,
    })
    notice.push({ type: 'success', message: 'Dossiê criado.' })
    modalDossie.value = false
    await load()
  } catch {
    notice.push({ type: 'error', message: 'Falha ao criar o dossiê.' })
  } finally {
    salvando.value = false
  }
}

async function adicionarItem(dossie: Dossie, templateId: string, obrigatorio = true) {
  try {
    await entidadeService.addItem(dossie.id, { templateId, obrigatorio })
    notice.push({ type: 'success', message: 'Item adicionado ao dossiê.' })
    await load()
  } catch {
    notice.push({ type: 'error', message: 'Falha ao adicionar o item.' })
  }
}

async function removerItem(item: DossieItem) {
  if (!window.confirm('Remover este item do dossiê?')) return
  try {
    await entidadeService.removeItem(item.id)
    await load()
  } catch {
    notice.push({ type: 'error', message: 'Não foi possível remover o item.' })
  }
}

async function requisitar(dossie: Dossie, item?: DossieItem) {
  try {
    const res = await entidadeService.requisitar(dossie.id, item?.id)
    notice.push({ type: 'success', message: `${res.solicitados} solicitação(ões) criada(s).` })
  } catch {
    notice.push({ type: 'error', message: 'Falha ao requisitar documentos.' })
  }
}

async function removerDossie(dossie: Dossie) {
  if (!window.confirm(`Excluir o dossiê "${dossie.nome}"?`)) return
  try {
    await entidadeService.removeDossie(dossie.id)
    notice.push({ type: 'success', message: 'Dossiê excluído.' })
    await load()
  } catch (e: any) {
    notice.push({ type: 'error', message: e.response?.data?.error || 'Não foi possível excluir o dossiê.' })
  }
}

function enviarItem(dossie: Dossie, item: DossieItem) {
  const input = document?.getElementById(`upload-item-${item.id}`) as HTMLInputElement | null
  input?.click()
}

async function onFileChange(dossie: Dossie, item: DossieItem, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    await entidadeService.uploadDocumento(dossie.id, item.id, file)
    notice.push({ type: 'success', message: `"${item.templateNome}" enviado para processamento.` })
    await load()
  } catch (e: any) {
    notice.push({ type: 'error', message: e.response?.data?.error || 'Falha no envio do documento.' })
  } finally {
    input.value = ''
  }
}

function corItem(item: DossieItem): string {
  if (item.status === 'atendido') return 'bg-green-50 text-green-700'
  if (item.status === 'vencido') return 'bg-red-50 text-red-700'
  return 'bg-amber-50 text-amber-700'
}

function rotuloItem(item: DossieItem): string {
  if (item.status === 'atendido') return 'Atendido'
  if (item.status === 'vencido') return 'Vencido'
  return 'Faltando'
}

onMounted(async () => {
  await templateStore.list().catch(() => undefined)
  await load()
})

const novoItem = ref<Record<string, { templateId: string; obrigatorio: boolean }>>({})

function itemDraft(dossieId: string) {
  return novoItem.value[dossieId] ?? { templateId: '', obrigatorio: true }
}

function patchItem(dossieId: string, patch: Partial<{ templateId: string; obrigatorio: boolean }>) {
  novoItem.value = { ...novoItem.value, [dossieId]: { ...itemDraft(dossieId), ...patch } }
}

function templatesFora(dossie: Dossie) {
  const usados = new Set((dossie.itens || []).map((item) => item.templateId))
  return activeTemplates.value.filter((template) => !usados.has(template.id))
}

async function confirmarItem(dossie: Dossie) {
  const draft = itemDraft(dossie.id)
  if (!draft.templateId) {
    notice.push({ type: 'warning', message: 'Escolha um modelo para adicionar.' })
    return
  }
  await adicionarItem(dossie, draft.templateId, draft.obrigatorio)
  patchItem(dossie.id, { templateId: '' })
}

const percentual = computed(() => conformidade.value?.percentual ?? 0)
const itensForaConformidade = computed(() =>
  (conformidade.value?.itens ?? []).filter((item) => item.status !== 'atendido'),
)

function irParaDocumento(item: DossieItem): string {
  return item.documento ? `/documentos/${item.documento.id}` : ''
}
</script>
<template>
  <div class="space-y-6">
    <BaseSpinner v-if="loading" />
    <template v-else-if="entidade">
      <PageHeader
        kicker="Entidades"
        :title="entidade.nome"
        :description="`${entidade.tipo === 'empresa' ? 'Empresa' : 'Pessoa'} · ${entidade.documentoIdentificador || entidade.cnpjOuCpf || 'Sem documento'} · desde ${formatDate(entidade.criadoEm)}`"
      >
        <RouterLink to="/entidades" class="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-ink-muted hover:bg-white">Voltar</RouterLink>
        <BaseButton @click="abrirNovoDossie">Novo dossiê</BaseButton>
      </PageHeader>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card !p-4">
          <p class="text-sm text-ink-muted">Conformidade</p>
          <p class="mt-1 text-3xl font-semibold" :class="percentual >= 100 ? 'text-emerald-700' : 'text-primary'">{{ percentual }}%</p>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full" :class="percentual >= 100 ? 'bg-emerald-500' : 'bg-primary'" :style="{ width: `${percentual}%` }" />
          </div>
        </div>
        <div class="card !p-4">
          <p class="text-sm text-ink-muted">Obrigatórios</p>
          <p class="mt-1 text-3xl font-semibold">{{ itensObrigatorios }}</p>
        </div>
        <div class="card !p-4">
          <p class="text-sm text-ink-muted">Atendidos</p>
          <p class="mt-1 text-3xl font-semibold text-emerald-700">{{ itensAtendidos }}</p>
        </div>
        <div class="card !p-4">
          <p class="text-sm text-ink-muted">Vencidos ou faltando</p>
          <p class="mt-1 text-3xl font-semibold" :class="itensForaConformidade.length ? 'text-amber-700' : 'text-ink'">{{ itensForaConformidade.length }}</p>
        </div>
      </div>

      <section v-if="conformidade" class="surface">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 class="text-sm font-semibold text-ink">Próxima ação</h2>
            <p class="text-sm text-ink-muted">{{ itensForaConformidade.length ? 'Envie ou solicite o que ainda não está em dia.' : 'Esta entidade está em conformidade.' }}</p>
          </div>
        </div>
        <ul v-if="itensForaConformidade.length" class="divide-y divide-line">
          <li v-for="item in itensForaConformidade" :key="item.dossieId + item.id" class="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span class="text-ink">{{ item.templateNome }} <span class="text-ink-muted">· {{ item.dossieNome || 'Dossiê' }}</span></span>
            <span :class="['rounded-full px-2.5 py-1 text-xs font-semibold', corItem(item)]">{{ rotuloItem(item) }}</span>
          </li>
        </ul>
      </section>

      <div v-if="!dossies.length" class="surface px-6 py-12 text-center">
        <p class="font-semibold text-ink">Nenhum dossiê nesta entidade</p>
        <p class="mt-1 text-sm text-ink-muted">O dossiê define quais modelos precisam estar válidos.</p>
        <BaseButton class="mt-4" @click="abrirNovoDossie">Criar dossiê</BaseButton>
      </div>

      <section v-for="dossie in dossies" :key="dossie.id" class="surface">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-semibold text-ink">{{ dossie.nome }}</h2>
              <DossieStatusBadge :status="dossie.status" />
            </div>
            <p v-if="dossie.descricao" class="mt-0.5 text-sm text-ink-muted">{{ dossie.descricao }}</p>
          </div>
          <RowMenu>
            <button type="button" class="menu-item" @click="requisitar(dossie)">Solicitar pendentes</button>
            <button type="button" class="menu-item menu-item-danger" @click="removerDossie(dossie)">Excluir dossiê</button>
          </RowMenu>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left">
            <thead class="bg-canvas">
              <tr>
                <th class="th">Documento exigido</th>
                <th class="th">Exigência</th>
                <th class="th">Situação</th>
                <th class="th">Arquivo</th>
                <th class="th text-right">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="item in dossie.itens" :key="item.id">
                <td class="td font-medium">{{ item.templateNome }}</td>
                <td class="td text-ink-muted">{{ item.obrigatorio ? 'Obrigatório' : 'Opcional' }}</td>
                <td class="td"><span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', corItem(item)]">{{ rotuloItem(item) }}</span></td>
                <td class="td">
                  <RouterLink v-if="item.documento" :to="irParaDocumento(item)" class="font-medium text-primary hover:underline">{{ item.documento.nomeArquivo }}</RouterLink>
                  <span v-else class="text-ink-muted">Ainda não enviado</span>
                  <ValidadeSeal v-if="item.documento?.statusValidade" :status="item.documento?.statusValidade" :dias-para-vencer="item.documento?.diasParaVencer" class="ml-2" />
                </td>
                <td class="td text-right">
                  <BaseButton v-if="item.status !== 'atendido'" @click="enviarItem(dossie, item)">Enviar PDF</BaseButton>
                  <RowMenu v-else>
                    <button type="button" class="menu-item" @click="enviarItem(dossie, item)">Substituir arquivo</button>
                    <button type="button" class="menu-item" @click="requisitar(dossie, item)">Solicitar novamente</button>
                    <button type="button" class="menu-item menu-item-danger" @click="removerItem(item)">Remover item</button>
                  </RowMenu>
                  <input :id="`upload-item-${item.id}`" type="file" accept=".pdf,application/pdf" class="hidden" @change="onFileChange(dossie, item, $event)" />
                  <RowMenu v-if="item.status !== 'atendido'">
                    <button type="button" class="menu-item" @click="requisitar(dossie, item)">Solicitar</button>
                    <button type="button" class="menu-item menu-item-danger" @click="removerItem(item)">Remover item</button>
                  </RowMenu>
                </td>
              </tr>
              <tr v-if="!dossie.itens?.length">
                <td colspan="5" class="px-5 py-6 text-sm text-ink-muted">Este dossiê ainda não exige nenhum modelo.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="templatesFora(dossie).length" class="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <select class="field max-w-xs" :aria-label="`Adicionar modelo em ${dossie.nome}`" :value="itemDraft(dossie.id).templateId" @change="patchItem(dossie.id, { templateId: ($event.target as HTMLSelectElement).value })">
            <option value="">Adicionar modelo…</option>
            <option v-for="template in templatesFora(dossie)" :key="template.id" :value="template.id">{{ template.nome }}</option>
          </select>
          <label class="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" class="h-4 w-4 rounded border-line text-primary" :checked="itemDraft(dossie.id).obrigatorio" @change="patchItem(dossie.id, { obrigatorio: ($event.target as HTMLInputElement).checked })" />
            Obrigatório
          </label>
          <BaseButton variant="secondary" @click="confirmarItem(dossie)">Adicionar</BaseButton>
        </div>
      </section>
    </template>

    <BaseModal :open="modalDossie" title="Novo dossiê" description="Escolha os modelos que esta entidade precisa manter em dia." @close="modalDossie = false">
      <form class="space-y-3" @submit.prevent="criarDossie">
        <BaseInput id="dossie-nome" v-model="dossieForm.nome" label="Nome" placeholder="Pasta anual" />
        <div>
          <p class="mb-1.5 text-sm font-medium text-ink">Modelos</p>
          <div v-if="activeTemplates.length" class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
            <label v-for="template in activeTemplates" :key="template.id" class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-canvas">
              <input v-model="templatesSelecionados[template.id]" type="checkbox" class="h-4 w-4" />
              <span class="flex-1 text-sm">{{ template.nome }}</span>
              <span class="flex items-center gap-1 text-xs text-ink-muted"><input type="checkbox" :checked="obrigatorios[template.id] !== false" @change="obrigatorios[template.id] = ($event.target as HTMLInputElement).checked" /> Obrigatório</span>
            </label>
          </div>
          <p v-else class="text-sm text-ink-muted">Nenhum modelo ativo disponível.</p>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" @click="modalDossie = false">Cancelar</BaseButton>
          <BaseButton type="submit" :loading="salvando">Criar</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>