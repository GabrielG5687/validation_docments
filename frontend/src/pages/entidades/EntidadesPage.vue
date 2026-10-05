<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { entidadeService } from '../../services/entidadeService'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import type { Entidade, TipoEntidade } from '../../types'
import { formatDate } from '../../utils/formatDate'
import BaseTable from '../../components/ui/BaseTable.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseModal from '../../components/ui/BaseModal.vue'

const auth = useAuthStore()
const notice = useNotificationStore()
const entidades = ref<Entidade[]>([])
const loading = ref(true)
const podeCriar = computed(() => auth.perfil === 'usuario' || auth.perfil === 'admin' || auth.perfil === 'coordenador')
const modalOpen = ref(false)
const salvando = ref(false)
const editando = ref<Entidade | null>(null)
const form = ref({ tipo: 'empresa' as TipoEntidade, nome: '', documentoIdentificador: '', cnpjOuCpf: '' })

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

onMounted(load)
</script>
<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <p class="muted">Compliance</p>
        <h1 class="page-title">Entidades</h1>
      </div>
      <BaseButton v-if="podeCriar" @click="abrirNova">Nova entidade</BaseButton>
    </div>
    <BaseSpinner v-if="loading" />
    <div v-else-if="!entidades.length" class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p class="font-medium text-slate-800">Nenhuma entidade cadastrada</p>
      <p class="muted mt-1 text-sm">Cadastre empresas ou pessoas para acompanhar a conformidade documental.</p>
      <BaseButton v-if="podeCriar" class="mt-4" @click="abrirNova">+ Nova entidade</BaseButton>
    </div>
    <BaseTable v-else>
      <template #head>
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 font-semibold">Nome</th>
            <th class="px-4 py-3 font-semibold">Tipo</th>
            <th class="px-4 py-3 font-semibold">Documento</th>
            <th class="px-4 py-3 font-semibold">Dossiês</th>
            <th class="px-4 py-3 font-semibold">Conformidade</th>
            <th class="px-4 py-3 font-semibold">Criada em</th>
            <th class="px-4 py-3 font-semibold">Ações</th>
          </tr>
        </thead>
      </template>
      <tr v-for="entidade in entidades" :key="entidade.id" class="hover:bg-slate-50">
        <td class="px-4 py-3">
          <RouterLink :to="`/entidades/${entidade.id}`" class="font-medium text-primary">{{ entidade.nome }}</RouterLink>
        </td>
        <td class="px-4 py-3 capitalize">{{ entidade.tipo === 'empresa' ? 'Empresa' : 'Pessoa' }}</td>
        <td class="px-4 py-3">{{ entidade.documentoIdentificador || entidade.cnpjOuCpf || '—' }}</td>
        <td class="px-4 py-3">{{ entidade._count?.dossies ?? entidade.dossies?.length ?? 0 }}</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <div class="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
              <div class="h-full rounded-full" :class="(entidade.conformidade?.percentual ?? 0) >= 100 ? 'bg-green-500' : 'bg-primary'" :style="{ width: `${entidade.conformidade?.percentual ?? 0}%` }" />
            </div>
            <span class="text-xs text-slate-600">{{ entidade.conformidade?.percentual ?? 0 }}%</span>
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-slate-500">{{ formatDate(entidade.criadoEm) }}</td>
        <td class="px-4 py-3">
          <div class="flex gap-2">
            <BaseButton variant="ghost" @click="abrirEdicao(entidade)">Editar</BaseButton>
            <BaseButton variant="ghost" class="!text-red-600 hover:!bg-red-50" @click="excluir(entidade)">Excluir</BaseButton>
          </div>
        </td>
      </tr>
    </BaseTable>

    <BaseModal :open="modalOpen" :title="editando ? 'Editar entidade' : 'Nova entidade'" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="salvar">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700" for="entidade-tipo">Tipo</label>
          <select id="entidade-tipo" v-model="form.tipo" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="empresa">Empresa</option>
            <option value="pessoa">Pessoa</option>
          </select>
        </div>
        <BaseInput id="entidade-nome" v-model="form.nome" label="Nome" placeholder="Nome da empresa ou pessoa" />
        <BaseInput id="entidade-doc" v-model="form.documentoIdentificador" label="Documento identificador" placeholder="Ex.: CNPJ / CPF / Inscrição municipal" />
        <BaseInput id="entidade-doc-num" v-model="form.cnpjOuCpf" label="Número (somente dígitos)" placeholder="Apenas números" />
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" @click="modalOpen = false">Cancelar</BaseButton>
          <BaseButton type="submit" :loading="salvando">Salvar</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>