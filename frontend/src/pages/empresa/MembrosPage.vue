<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { empresaService } from '../../services/empresaService'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import type { ConviteEmpresa, MembroEmpresa, PapelEmpresa } from '../../types'
import { formatDate } from '../../utils/formatDate'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseTable from '../../components/ui/BaseTable.vue'

const LINKS_KEY = 'docvalid_invite_links'

const auth = useAuthStore()
const notice = useNotificationStore()
const router = useRouter()

const loading = ref(true)
const erro = ref('')
const membros = ref<MembroEmpresa[]>([])
const convites = ref<ConviteEmpresa[]>([])
const busca = ref('')
const buscaDebounced = ref('')
const filtroPapel = ref('')
let buscaTimer: ReturnType<typeof setTimeout> | undefined

const modalConvite = ref(false)
const emailConvite = ref('')
const papelConvite = ref<'ADMIN' | 'MEMBER'>('MEMBER')
const salvando = ref(false)
const linkGerado = ref('')
const copiado = ref(false)
const linksCache = ref<Record<string, string>>(loadLinksCache())

const confirmacao = ref<{
  tipo: 'remover' | 'revogar' | 'papel' | 'novo-link'
  titulo: string
  mensagem: string
  confirmLabel: string
  membro?: MembroEmpresa
  convite?: ConviteEmpresa
  novoPapel?: 'ADMIN' | 'MEMBER'
} | null>(null)
const confirmando = ref(false)

const empresaId = computed(() => auth.empresaAtiva?.id || '')
const podeGerenciar = computed(() => auth.temPermissaoEmpresa('members.invite'))
const podeEditar = computed(() => auth.temPermissaoEmpresa('members.edit'))
const podeRemover = computed(() => auth.temPermissaoEmpresa('members.remove'))
const podeVer = computed(() => auth.temPermissaoEmpresa('members.view'))
const soOwner = computed(() => membros.value.length === 1 && membros.value[0]?.papel === 'OWNER')

function loadLinksCache(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(LINKS_KEY) || '{}')
  } catch {
    return {}
  }
}

function persistLink(id: string, link: string) {
  linksCache.value = { ...linksCache.value, [id]: link }
  sessionStorage.setItem(LINKS_KEY, JSON.stringify(linksCache.value))
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?'
}

function rotuloPapel(papel: PapelEmpresa) {
  if (papel === 'OWNER') return 'Proprietário'
  if (papel === 'ADMIN') return 'Admin'
  return 'Membro'
}

function diasRestantes(expiraEm: string) {
  const ms = new Date(expiraEm).getTime() - Date.now()
  const dias = Math.ceil(ms / 86400000)
  if (dias <= 0) return 'Expirado'
  if (dias === 1) return '1 dia'
  return `${dias} dias`
}

async function load() {
  if (!empresaId.value || !podeVer.value) {
    loading.value = false
    membros.value = []
    convites.value = []
    return
  }
  loading.value = true
  erro.value = ''
  try {
    const [m, c] = await Promise.all([
      empresaService.listMembros(empresaId.value, {
        q: buscaDebounced.value || undefined,
        papel: filtroPapel.value || undefined,
      }),
      empresaService.listConvites(empresaId.value),
    ])
    membros.value = m
    convites.value = c
  } catch {
    erro.value = 'Não foi possível carregar os membros.'
    membros.value = []
    convites.value = []
  } finally {
    loading.value = false
  }
}

function abrirConvite() {
  emailConvite.value = ''
  papelConvite.value = 'MEMBER'
  linkGerado.value = ''
  copiado.value = false
  modalConvite.value = true
}

async function gerarConvite() {
  if (!empresaId.value) return
  salvando.value = true
  try {
    const convite = await empresaService.criarConvite(empresaId.value, {
      email: emailConvite.value.trim().toLowerCase(),
      papel: papelConvite.value,
    })
    linkGerado.value = convite.link || ''
    if (convite.id && convite.link) persistLink(convite.id, convite.link)
    notice.push({ type: 'success', message: 'Convite criado.' })
    await load()
  } catch (e: any) {
    const msg = e.response?.data?.error || 'Falha ao gerar convite.'
    if (e.response?.data?.reutilizar && e.response?.data?.conviteId) {
      const cached = linksCache.value[e.response.data.conviteId]
      if (cached) {
        linkGerado.value = cached
        notice.push({ type: 'info', message: 'Já existe um convite pendente. Use o link abaixo.' })
        return
      }
      confirmacao.value = {
        tipo: 'novo-link',
        titulo: 'Convite pendente',
        mensagem: 'Já existe um convite para este e-mail. Gerar um novo link invalida o anterior.',
        confirmLabel: 'Gerar novo link',
        convite: { id: e.response.data.conviteId } as ConviteEmpresa,
      }
      return
    }
    notice.push({ type: 'error', message: msg })
  } finally {
    salvando.value = false
  }
}

async function copiarLink(link: string) {
  try {
    await navigator.clipboard.writeText(link)
    copiado.value = true
    notice.push({ type: 'success', message: 'Link copiado' })
    setTimeout(() => { copiado.value = false }, 2000)
  } catch {
    notice.push({ type: 'error', message: 'Não foi possível copiar o link.' })
  }
}

async function copiarConviteExistente(convite: ConviteEmpresa) {
  const cached = linksCache.value[convite.id]
  if (cached) {
    await copiarLink(cached)
    return
  }
  confirmacao.value = {
    tipo: 'novo-link',
    titulo: 'Gerar novo link',
    mensagem: `O link original não está disponível nesta sessão. Gerar um novo link para ${convite.email} invalida qualquer link anterior.`,
    confirmLabel: 'Gerar novo link',
    convite,
  }
}

function pedirRevogar(convite: ConviteEmpresa) {
  confirmacao.value = {
    tipo: 'revogar',
    titulo: 'Revogar convite',
    mensagem: `Revogar o convite para ${convite.email}? A pessoa não poderá mais usar o link.`,
    confirmLabel: 'Revogar',
    convite,
  }
}

function pedirRemover(membro: MembroEmpresa) {
  confirmacao.value = {
    tipo: 'remover',
    titulo: 'Remover membro',
    mensagem: `Remover ${membro.usuario.nome} da organização? Essa pessoa perderá o acesso imediato.`,
    confirmLabel: 'Remover',
    membro,
  }
}

function pedirAlterarPapel(membro: MembroEmpresa, papel: 'ADMIN' | 'MEMBER') {
  if (membro.papel === papel) return
  confirmacao.value = {
    tipo: 'papel',
    titulo: 'Alterar função',
    mensagem: `Alterar ${membro.usuario.nome} para ${rotuloPapel(papel)}?`,
    confirmLabel: 'Confirmar',
    membro,
    novoPapel: papel,
  }
}

async function confirmarAcao() {
  if (!confirmacao.value || !empresaId.value) return
  confirmando.value = true
  const acao = confirmacao.value
  try {
    if (acao.tipo === 'remover' && acao.membro) {
      await empresaService.removeMembro(empresaId.value, acao.membro.id)
      notice.push({ type: 'success', message: 'Membro removido.' })
    }
    if (acao.tipo === 'revogar' && acao.convite) {
      await empresaService.revogarConvite(empresaId.value, acao.convite.id)
      notice.push({ type: 'success', message: 'Convite revogado.' })
    }
    if (acao.tipo === 'papel' && acao.membro && acao.novoPapel) {
      await empresaService.updateMembro(empresaId.value, acao.membro.id, acao.novoPapel)
      notice.push({ type: 'success', message: 'Função atualizada.' })
    }
    if (acao.tipo === 'novo-link' && acao.convite) {
      const re = await empresaService.reemitirConvite(empresaId.value, acao.convite.id)
      if (re.link) {
        persistLink(re.id, re.link)
        linkGerado.value = re.link
        modalConvite.value = true
        await copiarLink(re.link)
      }
      notice.push({ type: 'success', message: 'Novo link gerado.' })
    }
    confirmacao.value = null
    await load()
  } catch (e: any) {
    notice.push({ type: 'error', message: e.response?.data?.error || 'Não foi possível concluir a ação.' })
  } finally {
    confirmando.value = false
  }
}

watch(busca, (value) => {
  clearTimeout(buscaTimer)
  buscaTimer = setTimeout(() => { buscaDebounced.value = value.trim() }, 300)
})
watch([buscaDebounced, filtroPapel, empresaId], () => { void load() })
onMounted(load)
onUnmounted(() => clearTimeout(buscaTimer))
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="muted">Organização</p>
        <h1 class="page-title">Membros</h1>
        <p class="muted mt-1">Gerencie quem tem acesso a {{ auth.empresaAtiva?.nome || 'esta organização' }}.</p>
      </div>
      <BaseButton v-if="podeGerenciar" @click="abrirConvite">+ Convidar membro</BaseButton>
    </div>

    <div v-if="!podeVer" class="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <p class="font-medium text-slate-800">Você não administra membros nesta organização.</p>
      <p class="muted mt-1 text-sm">Seu papel atual é {{ rotuloPapel(auth.empresaAtiva?.papel || 'MEMBER') }}. Peça a um administrador se precisar convidar alguém.</p>
      <BaseButton class="mt-5" variant="secondary" @click="router.push('/dashboard')">Ir ao Dashboard</BaseButton>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[220px] flex-1">
          <BaseInput id="busca-membros" v-model="busca" label="Pesquisar" placeholder="Nome ou e-mail" />
        </div>
        <div class="w-44">
          <label class="mb-1 block text-sm font-medium text-slate-700" for="filtro-papel">Função</label>
          <select id="filtro-papel" v-model="filtroPapel" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todas</option>
            <option value="OWNER">Proprietário</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Membro</option>
          </select>
        </div>
      </div>

      <div v-if="loading"><BaseSpinner /></div>
      <div v-else-if="erro" class="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p class="text-sm text-slate-600">{{ erro }}</p>
        <BaseButton class="mt-4" variant="secondary" @click="load">Tentar novamente</BaseButton>
      </div>
      <template v-else>
        <div v-if="soOwner && !buscaDebounced && !filtroPapel" class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4">
          <p class="text-sm font-medium text-slate-800">Só você faz parte desta organização.</p>
          <p class="muted mt-0.5 text-sm">Convide colegas para colaborar na validação documental.</p>
          <BaseButton v-if="podeGerenciar" class="mt-3" @click="abrirConvite">Convidar membro</BaseButton>
        </div>

        <BaseTable :empty="membros.length ? undefined : (buscaDebounced || filtroPapel ? 'Nenhum membro encontrado.' : undefined)">
          <template #head>
            <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-3 font-semibold">Nome</th>
                <th class="px-4 py-3 font-semibold">E-mail</th>
                <th class="px-4 py-3 font-semibold">Função</th>
                <th class="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
          </template>
          <tr v-for="membro in membros" :key="membro.id" class="hover:bg-slate-50">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{{ iniciais(membro.usuario.nome) }}</span>
                <div>
                  <p class="font-medium text-slate-900">{{ membro.usuario.nome }}</p>
                  <p v-if="!membro.usuario.status" class="text-xs text-red-600">Inativo</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-slate-600">{{ membro.usuario.email }}</td>
            <td class="px-4 py-3">
              <select
                v-if="podeEditar && membro.papel !== 'OWNER'"
                class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                :value="membro.papel"
                @change="pedirAlterarPapel(membro, ($event.target as HTMLSelectElement).value as 'ADMIN' | 'MEMBER'); ($event.target as HTMLSelectElement).value = membro.papel"
              >
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Membro</option>
              </select>
              <span v-else class="text-sm font-medium text-slate-700">{{ rotuloPapel(membro.papel) }}</span>
            </td>
            <td class="px-4 py-3">
              <BaseButton
                v-if="podeRemover && membro.papel !== 'OWNER' && membro.usuario.id !== auth.user?.id"
                variant="ghost"
                class="!text-red-600 hover:!bg-red-50"
                @click="pedirRemover(membro)"
              >
                Remover
              </BaseButton>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>
          </tr>
        </BaseTable>

        <section class="space-y-3">
          <h2 class="text-lg font-semibold text-slate-900">Convites pendentes</h2>
          <p v-if="!convites.length" class="muted text-sm">Nenhum convite pendente.</p>
          <BaseTable v-else>
            <template #head>
              <thead class="bg-slate-50">
                <tr>
                  <th class="px-4 py-3 font-semibold">E-mail</th>
                  <th class="px-4 py-3 font-semibold">Função</th>
                  <th class="px-4 py-3 font-semibold">Expiração</th>
                  <th class="px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
            </template>
            <tr v-for="convite in convites" :key="convite.id" class="hover:bg-slate-50">
              <td class="px-4 py-3 text-sm">{{ convite.email }}</td>
              <td class="px-4 py-3 text-sm">{{ rotuloPapel(convite.papel) }}</td>
              <td class="px-4 py-3 text-sm text-slate-600">{{ diasRestantes(convite.expiraEm) }} · {{ formatDate(convite.expiraEm) }}</td>
              <td class="px-4 py-3">
                <div v-if="podeGerenciar" class="flex flex-wrap gap-2">
                  <BaseButton variant="ghost" @click="copiarConviteExistente(convite)">
                    {{ linksCache[convite.id] ? 'Copiar link' : 'Novo link' }}
                  </BaseButton>
                  <BaseButton variant="ghost" class="!text-red-600 hover:!bg-red-50" @click="pedirRevogar(convite)">Revogar</BaseButton>
                </div>
              </td>
            </tr>
          </BaseTable>
        </section>
      </template>
    </template>

    <BaseModal :open="modalConvite" :title="linkGerado ? 'Convite criado' : 'Convidar membro'" @close="modalConvite = false">
      <div v-if="!linkGerado" class="space-y-4">
        <p class="text-sm text-slate-600">Envie um convite para alguém participar de {{ auth.empresaAtiva?.nome || 'sua organização' }}.</p>
        <BaseInput id="convite-email" v-model="emailConvite" label="E-mail" type="email" placeholder="joao@empresa.com" />
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700" for="convite-papel">Função</label>
          <select id="convite-papel" v-model="papelConvite" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="MEMBER">Membro</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" @click="modalConvite = false">Cancelar</BaseButton>
          <BaseButton :loading="salvando" @click="gerarConvite">Gerar convite</BaseButton>
        </div>
      </div>
      <div v-else class="space-y-4">
        <p class="text-sm text-slate-600">Envie este link para a pessoa convidada:</p>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm break-all text-slate-800">{{ linkGerado }}</div>
        <p class="text-xs text-slate-500">Expira em 48 horas. Guarde o link — ele só pode ser regenerado depois.</p>
        <div class="flex justify-end gap-2">
          <BaseButton variant="secondary" @click="modalConvite = false">Fechar</BaseButton>
          <BaseButton @click="copiarLink(linkGerado)">{{ copiado ? 'Link copiado' : 'Copiar link' }}</BaseButton>
        </div>
      </div>
    </BaseModal>

    <BaseModal
      :open="Boolean(confirmacao)"
      :title="confirmacao?.titulo || 'Confirmar'"
      @close="confirmacao = null"
    >
      <div class="space-y-4">
        <p class="text-sm text-slate-600">{{ confirmacao?.mensagem }}</p>
        <div class="flex justify-end gap-2">
          <BaseButton variant="secondary" @click="confirmacao = null">Cancelar</BaseButton>
          <BaseButton
            :variant="confirmacao?.tipo === 'remover' || confirmacao?.tipo === 'revogar' ? 'danger' : 'primary'"
            :loading="confirmando"
            @click="confirmarAcao"
          >
            {{ confirmacao?.confirmLabel }}
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
