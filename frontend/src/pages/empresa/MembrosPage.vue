<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import PageHeader from '../../components/ui/PageHeader.vue'
import RowMenu from '../../components/ui/RowMenu.vue'

const LINKS_KEY = 'docvalid_invite_links'

const auth = useAuthStore()
const notice = useNotificationStore()
const router = useRouter()
const route = useRoute()

const loading = ref(true)
const erro = ref('')
const membros = ref<MembroEmpresa[]>([])
const convites = ref<ConviteEmpresa[]>([])
const busca = ref(typeof route.query.q === 'string' ? route.query.q : '')
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

watch(() => route.query.q, (q) => {
  if (typeof q === 'string') busca.value = q
})
watch(busca, (value) => {
  clearTimeout(buscaTimer)
  buscaTimer = setTimeout(() => { buscaDebounced.value = value.trim() }, 300)
})
watch([buscaDebounced, filtroPapel, empresaId], () => { void load() })
onMounted(load)
onUnmounted(() => clearTimeout(buscaTimer))
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Membros"
      :description="`Gerencie os usuários de ${auth.empresaAtiva?.nome || 'sua organização'}.`"
    >
      <BaseButton v-if="podeGerenciar" @click="abrirConvite">+ Novo membro</BaseButton>
    </PageHeader>

    <div v-if="!podeVer" class="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <p class="font-medium text-slate-800">Você não administra membros nesta organização.</p>
      <p class="muted mt-1 text-sm">Seu papel atual é {{ rotuloPapel(auth.empresaAtiva?.papel || 'MEMBER') }}. Peça a um administrador se precisar convidar alguém.</p>
      <BaseButton class="mt-5" variant="secondary" @click="router.push('/dashboard')">Ir ao Dashboard</BaseButton>
    </div>

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row">
        <input id="busca-membros" v-model="busca" class="field sm:max-w-sm" placeholder="Buscar por nome, e-mail ou cargo" aria-label="Buscar membros" />
        <select id="filtro-papel" v-model="filtroPapel" class="field sm:w-44" aria-label="Filtrar por função">
          <option value="">Todos os papéis</option>
          <option value="OWNER">Proprietário</option>
          <option value="ADMIN">Admin</option>
          <option value="MEMBER">Membro</option>
        </select>
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
            <thead class="bg-canvas">
              <tr>
                <th class="th">Nome</th>
                <th class="th">E-mail</th>
                <th class="th">Papel</th>
                <th class="th">Status</th>
                <th class="th text-right">Ações</th>
              </tr>
            </thead>
          </template>
          <tr v-for="membro in membros" :key="membro.id" class="hover:bg-canvas/70">
            <td class="td">
              <div class="flex items-center gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">{{ iniciais(membro.usuario.nome) }}</span>
                <p class="font-medium text-ink">{{ membro.usuario.nome }}</p>
              </div>
            </td>
            <td class="td text-ink-muted">{{ membro.usuario.email }}</td>
            <td class="td">
              <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink">{{ rotuloPapel(membro.papel) }}</span>
            </td>
            <td class="td">
              <span v-if="membro.usuario.status" class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />Ativo
              </span>
              <span v-else class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Inativo</span>
            </td>
            <td class="td text-right">
              <RowMenu v-if="(podeEditar && membro.papel !== 'OWNER') || (podeRemover && membro.papel !== 'OWNER' && membro.usuario.id !== auth.user?.id)">
                <button v-if="podeEditar && membro.papel === 'MEMBER'" type="button" class="menu-item" @click="pedirAlterarPapel(membro, 'ADMIN')">Tornar admin</button>
                <button v-if="podeEditar && membro.papel === 'ADMIN'" type="button" class="menu-item" @click="pedirAlterarPapel(membro, 'MEMBER')">Tornar membro</button>
                <button v-if="podeRemover && membro.usuario.id !== auth.user?.id" type="button" class="menu-item menu-item-danger" @click="pedirRemover(membro)">Remover</button>
              </RowMenu>
              <span v-else class="text-xs text-ink-muted">—</span>
            </td>
          </tr>
        </BaseTable>

        <section class="space-y-3">
          <h2 class="text-base font-semibold text-ink">Convites pendentes</h2>
          <p v-if="!convites.length" class="text-sm text-ink-muted">Nenhum convite pendente.</p>
          <BaseTable v-else>
            <template #head>
              <thead class="bg-canvas">
                <tr>
                  <th class="th">E-mail</th>
                  <th class="th">Papel</th>
                  <th class="th">Status</th>
                  <th class="th">Expira</th>
                  <th class="th text-right">Ações</th>
                </tr>
              </thead>
            </template>
            <tr v-for="convite in convites" :key="convite.id" class="hover:bg-canvas/70">
              <td class="td">{{ convite.email }}</td>
              <td class="td"><span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink">{{ rotuloPapel(convite.papel) }}</span></td>
              <td class="td"><span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><span class="h-1.5 w-1.5 rounded-full bg-amber-500" />Pendente</span></td>
              <td class="td text-ink-muted">{{ diasRestantes(convite.expiraEm) }} · {{ formatDate(convite.expiraEm) }}</td>
              <td class="td text-right">
                <RowMenu v-if="podeGerenciar">
                  <button type="button" class="menu-item" @click="copiarConviteExistente(convite)">{{ linksCache[convite.id] ? 'Copiar link' : 'Gerar novo link' }}</button>
                  <button type="button" class="menu-item menu-item-danger" @click="pedirRevogar(convite)">Revogar</button>
                </RowMenu>
              </td>
            </tr>
          </BaseTable>
        </section>
      </template>
    </template>

    <BaseModal :open="modalConvite" :title="linkGerado ? 'Convite criado' : 'Novo membro'" :description="linkGerado ? 'Envie o link para a pessoa entrar na organização.' : 'O convite expira em 48 horas.'" @close="modalConvite = false">
      <div v-if="!linkGerado" class="space-y-4">
        <p class="text-sm text-slate-600">Envie um convite para alguém participar de {{ auth.empresaAtiva?.nome || 'sua organização' }}.</p>
        <BaseInput id="convite-email" v-model="emailConvite" label="E-mail" type="email" placeholder="joao@empresa.com" />
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink" for="convite-papel">Papel</label>
          <select id="convite-papel" v-model="papelConvite" class="field">
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
