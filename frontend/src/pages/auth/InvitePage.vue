<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { empresaService } from '../../services/empresaService'
import { useAuthStore } from '../../stores/auth'
import { authService } from '../../services/authService'
import type { ConvitePreview } from '../../types'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BrandLogo from '../../components/common/BrandLogo.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = computed(() => String(route.params.token || ''))
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const preview = ref<ConvitePreview | null>(null)
const nome = ref('')
const senha = ref('')
const confirmarSenha = ref('')

const mesmoEmail = computed(() =>
  Boolean(auth.user && preview.value && auth.user.email.toLowerCase() === preview.value.email.toLowerCase()),
)

const logadoOutroEmail = computed(() =>
  Boolean(auth.user && preview.value && auth.user.email.toLowerCase() !== preview.value.email.toLowerCase()),
)

async function load() {
  loading.value = true
  error.value = ''
  preview.value = null
  try {
    preview.value = await empresaService.previewConvite(token.value)
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      error.value = (e.response?.data as { error?: string })?.error || 'Convite inválido.'
    } else {
      error.value = 'Convite inválido.'
    }
  } finally {
    loading.value = false
  }
}

async function aceitarLogado() {
  submitting.value = true
  error.value = ''
  try {
    const res = await empresaService.aceitarConvite(token.value)
    auth.setSession(res.user, res.token, auth.empresas, res.empresa.id)
    try {
      const me = await authService.me()
      auth.setSession(res.user, res.token, me.empresas, res.empresa.id)
    } catch {
      /* mantém sessão do aceite */
    }
    await router.push('/dashboard')
  } catch (e: unknown) {
    error.value = axios.isAxiosError(e)
      ? (e.response?.data as { error?: string })?.error || 'Não foi possível aceitar o convite.'
      : 'Não foi possível aceitar o convite.'
  } finally {
    submitting.value = false
  }
}

async function criarEAceitar() {
  const nomeTrim = nome.value.trim()
  if (nomeTrim.length < 2) {
    error.value = 'Informe um nome com pelo menos 2 caracteres.'
    return
  }
  if (senha.value.length < 8) {
    error.value = 'A senha deve ter pelo menos 8 caracteres.'
    return
  }
  if (senha.value !== confirmarSenha.value) {
    error.value = 'As senhas não coincidem.'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    // asGuest evita Bearer antigo interferir no cadastro via convite
    const res = await empresaService.aceitarConvite(token.value, {
      nome: nomeTrim,
      senha: senha.value,
      confirmarSenha: confirmarSenha.value,
      email: preview.value?.email,
    }, { asGuest: true })
    auth.setSession(res.user, res.token, [{
      id: res.empresa.id,
      nome: res.empresa.nome,
      papel: res.membro.papel,
      permissoes: [],
      criadoEm: new Date().toISOString(),
    }], res.empresa.id)
    try {
      const me = await authService.me()
      auth.setSession(res.user, res.token, me.empresas, res.empresa.id)
    } catch {
      /* sessão já definida com o retorno do aceite */
    }
    await router.push('/dashboard')
  } catch (e: unknown) {
    error.value = axios.isAxiosError(e)
      ? (e.response?.data as { error?: string })?.error || 'Não foi possível criar a conta.'
      : 'Não foi possível criar a conta.'
  } finally {
    submitting.value = false
  }
}

function irLogin() {
  router.push({ path: '/login', query: { redirect: `/convite/${token.value}` } })
}

function sairEContinuar() {
  auth.logout()
  if (preview.value?.contaExiste) irLogin()
}

onMounted(load)
</script>

<template>
  <section class="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-md">
    <div class="mb-6 flex justify-center">
      <BrandLogo size="lg" />
    </div>

    <BaseSpinner v-if="loading" />
    <template v-else>
      <BaseAlert v-if="error && !preview" type="error" :message="error" class="mb-4" />
      <template v-if="preview">
        <p class="text-sm text-slate-500">Você foi convidado para</p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{{ preview.empresa.nome }}</h1>
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <p>Função: <span class="font-medium text-slate-800">{{ preview.papelRotulo }}</span></p>
          <p>E-mail: <span class="font-medium text-slate-800">{{ preview.email }}</span></p>
        </div>

        <BaseAlert v-if="error" type="error" :message="error" class="mt-4" />

        <div v-if="logadoOutroEmail" class="mt-6 space-y-3">
          <p class="text-sm text-slate-600">
            Você está logado como <strong>{{ auth.user?.email }}</strong>, mas este convite é para <strong>{{ preview.email }}</strong>.
          </p>
          <BaseButton class="w-full" variant="secondary" @click="sairEContinuar">Sair e continuar com o convite</BaseButton>
        </div>

        <div v-else-if="mesmoEmail" class="mt-6 space-y-3">
          <BaseButton class="w-full" :loading="submitting" @click="aceitarLogado">Aceitar convite</BaseButton>
        </div>

        <div v-else-if="preview.contaExiste" class="mt-6 space-y-3">
          <p class="text-sm text-slate-600">Já existe uma conta com este e-mail. Entre para aceitar o convite.</p>
          <BaseButton class="w-full" @click="irLogin">Entrar na conta</BaseButton>
        </div>

        <form v-else class="mt-6 space-y-4" @submit.prevent="criarEAceitar">
          <p class="text-sm font-medium text-slate-800">Crie sua conta para entrar</p>
          <BaseInput id="invite-nome" v-model="nome" label="Nome" />
          <div>
            <p class="mb-1 text-sm font-medium text-slate-700">E-mail</p>
            <p class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{{ preview.email }}</p>
          </div>
          <BaseInput id="invite-senha" v-model="senha" label="Senha" type="password" />
          <BaseInput id="invite-confirm" v-model="confirmarSenha" label="Confirmar senha" type="password" />
          <BaseButton class="w-full" type="submit" :loading="submitting">Criar conta e aceitar convite</BaseButton>
        </form>
      </template>
    </template>
  </section>
</template>
