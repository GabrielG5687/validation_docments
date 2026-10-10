<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Building2, UserRound } from 'lucide-vue-next'
import { entidadeService } from '../../services/entidadeService'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import type { Entidade, TipoEntidade } from '../../types'
import BaseTable from '../../components/ui/BaseTable.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import PageHeader from '../../components/ui/PageHeader.vue'
import RowMenu from '../../components/ui/RowMenu.vue'
import DossieStatusBadge from '../../components/entidades/DossieStatusBadge.vue'

const auth = useAuthStore()
const notice = useNotificationStore()
const route = useRoute()
const entidades = ref<Entidade[]>([])
const loading = ref(true)
const podeCriar = computed(() => auth.perfil === 'usuario' || auth.perfil === 'admin' || auth.perfil === 'coordenador')
const modalOpen = ref(false)
const salvando = ref(false)
const editando = ref<Entidade | null>(null)
const form = ref({ tipo: 'empresa' as TipoEntidade, nome: '', documentoIdentificador: '', cnpjOuCpf: '' })
const busca = ref(typeof route.query.q === 'string' ? route.query.q : '')
const filtroTipo = ref<'' | TipoEntidade>('')

const filtradas = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return entidades.value.filter((entidade) => {
    const tipoOk = !filtroTipo.value || entidade.tipo === filtroTipo.value
    const texto = `${entidade.nome} ${entidade.documentoIdentificador || ''} ${entidade.cnpjOuCpf || ''}`.toLowerCase()
    return tipoOk && (!q || texto.includes(q))
  })
})

function conformidadeDe(entidade: Entidade) {
  return entidade.conformidade?.percentual ?? 0
}

function statusDossie(entidade: Entidade) {
  return conformidadeDe(entidade) >= 100 && (entidade.conformidade?.totalItens ?? 0) > 0 ? 'em_compliance' : 'pendente'
}

async function load() {
  loading.value = true
  try {
    entidades.value = await entidadeService.list()
  } catch {
    notice.push({ type: 'error', message: 'Não foi possível carregar as entidades.' })
  } finally {
    loading.value = false
  }
}

function abrirNova() {
  editando.value = null
  form.value = { tipo: 'empresa', nome: '', documentoIdentificador: '', cnpjOuCpf: '' }
  modalOpen.value = true
}

function abrirEdicao(entidade: Entidade) {
  editando.value = entidade
  form.value = { tipo: entidade.tipo, nome: entidade.nome, documentoIdentificador: entidade.documentoIdentificador || '', cnpjOuCpf: entidade.cnpjOuCpf || '' }
  modalOpen.value = true
}

async function salvar() {
  if (!form.value.nome.trim()) {
    notice.push({ type: 'warning', message: 'Informe o nome da entidade.' })
    return
  }
  salvando.value = true
  try {
    const payload = {
      tipo: form.value.tipo,
      nome: form.value.nome.trim(),
      documentoIdentificador: form.value.documentoIdentificador.trim() || undefined,
      cnpjOuCpf: form.value.cnpjOuCpf.trim() || undefined,
    }
    if (editando.value) {
      await entidadeService.update(editando.value.id, payload)
      notice.push({ type: 'success', message: 'Entidade atualizada.' })
    } else {
      await entidadeService.create(payload)
      notice.push({ type: 'success', message: 'Entidade criada.' })
    }
    modalOpen.value = false
    await load()
  } catch {
    notice.push({ type: 'error', message: 'Falha ao salvar a entidade.' })
  } finally {
    salvando.value = false
  }
}

async function excluir(entidade: Entidade) {
  if (!window.confirm(`Excluir a entidade "${entidade.nome}"?`)) return
  try {
    await entidadeService.remove(entidade.id)
    notice.push({ type: 'success', message: 'Entidade excluída.' })
    await load()
  } catch (e: any) {
    notice.push({ type: 'error', message: e.response?.data?.error || 'Não foi possível excluir.' })
  }
}

watch(() => route.query.q, (q) => {
  if (typeof q === 'string') busca.value = q
})

onMounted(load)
</script>
<template>
  <div>
    <PageHeader
      title="Entidades"
      description="Acompanhe a conformidade documental de cada empresa ou pessoa."
    >
      <BaseButton v-if="podeCriar" @click="abrirNova">+ Nova entidade</BaseButton>
    </PageHeader>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row">
      <input v-model="busca" class="field sm:max-w-sm" placeholder="Buscar por nome ou documento" aria-label="Buscar entidades" />
      <select v-model="filtroTipo" class="field sm:w-44" aria-label="Filtrar por tipo">
        <option value="">Todos os tipos</option>
        <option value="empresa">Empresa</option>
        <option value="pessoa">Pessoa</option>
      </select>
    </div>

    <BaseSpinner v-if="loading" />
    <div v-else-if="!entidades.length" class="surface px-6 py-16 text-center">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
        <Building2 class="h-6 w-6" />
      </div>
      <p class="mt-4 text-base font-semibold text-ink">Nenhuma entidade cadastrada ainda</p>
      <p class="mx-auto mt-1 max-w-md text-sm text-ink-muted">As entidades reúnem documentos, dossiês e modelos em um único lugar.</p>
      <BaseButton v-if="podeCriar" class="mt-5" @click="abrirNova">+ Criar entidade</BaseButton>
    </div>
    <BaseTable v-else :empty="filtradas.length ? undefined : 'Nenhuma entidade encontrada para esta busca.'">
      <template #head>
        <thead class="bg-canvas">
          <tr>
            <th class="th">Nome</th>
            <th class="th">Tipo</th>
            <th class="th">Documento</th>
            <th class="th">Dossiês</th>
            <th class="th">Conformidade</th>
            <th class="th">Situação</th>
            <th class="th text-right">Ações</th>
          </tr>
        </thead>
      </template>
      <tr v-for="entidade in filtradas" :key="entidade.id" class="hover:bg-canvas/70">
        <td class="td">
          <RouterLink :to="`/entidades/${entidade.id}`" class="flex items-center gap-3 font-medium text-ink hover:text-primary">
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-primary">
              <Building2 v-if="entidade.tipo === 'empresa'" class="h-4 w-4" />
              <UserRound v-else class="h-4 w-4" />
            </span>
            {{ entidade.nome }}
          </RouterLink>
        </td>
        <td class="td text-ink-muted">{{ entidade.tipo === 'empresa' ? 'Empresa' : 'Pessoa' }}</td>
        <td class="td text-ink-muted">{{ entidade.documentoIdentificador || entidade.cnpjOuCpf || '—' }}</td>
        <td class="td">{{ entidade._count?.dossies ?? entidade.dossies?.length ?? 0 }}</td>
        <td class="td">
          <div class="flex items-center gap-2">
            <div class="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full" :class="conformidadeDe(entidade) >= 100 ? 'bg-emerald-500' : 'bg-primary'" :style="{ width: `${conformidadeDe(entidade)}%` }" />
            </div>
            <span class="text-xs font-medium text-ink-muted">{{ conformidadeDe(entidade) }}%</span>
          </div>
        </td>
        <td class="td"><DossieStatusBadge :status="statusDossie(entidade)" /></td>
        <td class="td text-right">
          <RowMenu>
            <RouterLink class="menu-item" :to="`/entidades/${entidade.id}`">Abrir dossiê</RouterLink>
            <button v-if="podeCriar" type="button" class="menu-item" @click="abrirEdicao(entidade)">Editar</button>
            <button v-if="podeCriar" type="button" class="menu-item menu-item-danger" @click="excluir(entidade)">Excluir</button>
          </RowMenu>
        </td>
      </tr>
    </BaseTable>

    <BaseModal
      :open="modalOpen"
      :title="editando ? 'Editar entidade' : 'Nova entidade'"
      description="Nome e documento bastam para começar o dossiê."
      @close="modalOpen = false"
    >
      <form class="space-y-3" @submit.prevent="salvar">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink" for="entidade-tipo">Tipo</label>
          <select id="entidade-tipo" v-model="form.tipo" class="field">
            <option value="empresa">Empresa</option>
            <option value="pessoa">Pessoa</option>
          </select>
        </div>
        <BaseInput id="entidade-nome" v-model="form.nome" label="Nome" placeholder="Razão social ou nome completo" />
        <BaseInput id="entidade-doc" v-model="form.documentoIdentificador" label="Documento" :placeholder="form.tipo === 'empresa' ? 'CNPJ' : 'CPF'" />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :loading="salvando">{{ editando ? 'Salvar' : 'Criar' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
