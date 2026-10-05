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
    <template v-if="loading">
      <BaseSpinner />
    </template>
    <template v-else-if="entidade">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="muted"><RouterLink to="/entidades" class="hover:text-primary">Entidades</RouterLink> / detalhe</p>
          <h1 class="page-title">{{ entidade.nome }}</h1>
          <p class="muted">{{ entidade.tipo === 'empresa' ? 'Empresa' : 'Pessoa' }} · {{ entidade.documentoIdentificador || entidade.cnpjOuCpf || 'Sem documento' }} · Criada em {{ formatDate(entidade.criadoEm) }}</p>
        </div>
        <BaseButton @click="abrirNovoDossie">Novo dossiê</BaseButton>
      </div>

      <div class="grid gap-4 sm:grid-cols-4">
        <div class="card">
          <p class="muted text-sm">Conformidade</p>
          <p class="text-3xl font-bold" :class="percentual >= 100 ? 'text-green-600' : 'text-primary'">{{ percentual }}%</p>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div class="h-full rounded-full" :class="percentual >= 100 ? 'bg-green-500' : 'bg-primary'" :style="{ width: `${percentual}%` }" />
          </div>
        </div>
        <div class="card">
          <p class="muted text-sm">Obrigatórios</p>
          <p class="text-3xl font-bold">{{ itensObrigatorios }}</p>
        </div>
        <div class="card">
          <p class="muted text-sm">Atendidos</p>
          <p class="text-3xl font-bold text-green-600">{{ itensAtendidos }}</p>
        </div>
        <div class="card">
          <p class="muted text-sm">Vencidos</p>
          <p class="text-3xl font-bold" :class="itensVencidos ? 'text-red-600' : 'text-slate-700'">{{ itensVencidos }}</p>
        </div>
      </div>

      <div v-if="conformidade" class="card p-4">
        <h2 class="mb-3 font-semibold">Itens fora de conformidade</h2>
        <ul v-if="itensForaConformidade.length" class="divide-y divide-slate-100">
          <li v-for="item in itensForaConformidade" :key="item.dossieId + item.id" class="flex items-center justify-between gap-3 py-2 text-sm">
            <span class="text-slate-700">{{ item.dossieNome || 'Dossiê' }} — {{ item.templateNome }} <em v-if="!item.obrigatorio" class="text-slate-400">(opcional)</em></span>
            <span :class="['rounded-full px-2.5 py-1 text-xs font-semibold', corItem(item)]">{{ rotuloItem(item) }}</span>
          </li>
        </ul>
        <p v-else class="muted text-sm">Nenhum item pendente. Entidade em conformidade.</p>
      </div>

      <div v-if="!dossies.length" class="card muted">Nenhum dossiê criado para esta entidade.</div>

      <div v-for="dossie in dossies" :key="dossie.id" class="card space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold">{{ dossie.nome }}</h2>
            <p v-if="dossie.descricao" class="muted mt-0.5 text-sm">{{ dossie.descricao }}</p>
          </div>
          <div class="flex items-center gap-3">
            <DossieStatusBadge :status="dossie.status" />
            <BaseButton variant="ghost" @click="requisitar(dossie)">Requisitar</BaseButton>
            <BaseButton variant="ghost" @click="removerDossie(dossie)">Excluir</BaseButton>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th class="py-2 pr-4">Item</th>
                <th class="py-2 pr-4">Obrigatório</th>
                <th class="py-2 pr-4">Status</th>
                <th class="py-2 pr-4">Documento</th>
                <th class="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in dossie.itens" :key="item.id" class="border-b border-slate-50">
                <td class="py-2 pr-4">{{ item.templateNome }}</td>
                <td class="py-2 pr-4">{{ item.obrigatorio ? 'Sim' : 'Não' }}</td>
                <td class="py-2 pr-4"><span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', corItem(item)]">{{ rotuloItem(item) }}</span></td>
                <td class="py-2 pr-4">
                  <RouterLink v-if="item.documento" :to="irParaDocumento(item)" class="text-primary hover:underline">{{ item.documento.nomeArquivo }}</RouterLink>
                  <span v-else class="muted">—</span>
                  <ValidadeSeal v-if="item.documento?.statusValidade" :status="item.documento?.statusValidade" :dias-para-vencer="item.documento?.diasParaVencer" class="ml-2" />
                </td>
                <td class="py-2 text-right">
                  <div class="flex justify-end gap-2">
                    <BaseButton variant="ghost" @click="enviarItem(dossie, item)">Enviar</BaseButton>
                    <BaseButton variant="ghost" @click="requisitar(dossie, item)">Solicitar</BaseButton>
                    <BaseButton variant="ghost" @click="removerItem(item)">Remover</BaseButton>
                    <input :id="`upload-item-${item.id}`" type="file" accept=".pdf,application/pdf" class="hidden" @change="onFileChange(dossie, item, $event)" />
                  </div>
                </td>
              </tr>
              <tr v-if="!dossie.itens?.length">
                <td colspan="5" class="py-3 muted">Dossiê sem itens.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="activeTemplates.length" class="border-t border-slate-100 pt-3">
          <p class="mb-2 text-xs font-semibold uppercase text-slate-500">Adicionar item ao dossiê</p>
          <div class="flex flex-wrap gap-2">
            <div v-for="template in activeTemplates" :key="template.id" class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <span class="text-slate-700">{{ template.nome }}</span>
              <label class="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" checked /> Obrigatório</label>
              <button class="text-primary hover:underline" @click="adicionarItem(dossie, template.id, true)">+ Adicionar</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <BaseModal :open="modalDossie" title="Novo dossiê" @close="modalDossie = false">
      <form class="space-y-4" @submit.prevent="criarDossie">
        <BaseInput id="dossie-nome" v-model="dossieForm.nome" label="Nome" placeholder="Ex.: Pasta anual da empresa" />
        <BaseInput id="dossie-desc" v-model="dossieForm.descricao" label="Descrição" placeholder="Opcional" />
        <div>
          <p class="mb-2 text-sm font-medium text-slate-700">Templates</p>
          <div v-if="activeTemplates.length" class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            <label v-for="template in activeTemplates" :key="template.id" class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
              <input v-model="templatesSelecionados[template.id]" type="checkbox" class="h-4 w-4" />
              <span class="flex-1 text-sm">{{ template.nome }}</span>
              <label class="flex items-center gap-1 text-xs text-slate-500"><input v-model="obrigatorios[template.id]" type="checkbox" checked /> Obrigatório</label>
            </label>
          </div>
          <p v-else class="muted text-sm">Nenhum template ativo disponível.</p>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" @click="modalDossie = false">Cancelar</BaseButton>
          <BaseButton type="submit" :loading="salvando">Criar</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>