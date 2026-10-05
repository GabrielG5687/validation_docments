<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'
import BrandLogo from '../../components/common/BrandLogo.vue'

const nome = ref('')
const nomeEmpresa = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()
const auth = useAuth()

async function submit() {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = 'As senhas não coincidem.'
    return
  }
  if (!nomeEmpresa.value.trim()) {
    error.value = 'Informe o nome da empresa.'
    return
  }
  loading.value = true
  try {
    await auth.cadastrar(nome.value, email.value, password.value, nomeEmpresa.value.trim())
    await router.push('/dashboard')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Não foi possível concluir o cadastro.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-md">
    <div class="mb-8 text-center">
      <div class="mx-auto mb-5 flex justify-center">
        <BrandLogo size="lg" />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Crie sua organização</h1>
      <p class="mt-1.5 text-sm text-slate-500">Vamos criar seu espaço de trabalho.</p>
    </div>
    <BaseAlert v-if="error" type="error" :message="error" class="mb-4" />
    <form class="space-y-4" @submit.prevent="submit">
      <BaseInput id="nome" v-model="nome" label="Seu nome" />
      <BaseInput id="nomeEmpresa" v-model="nomeEmpresa" label="Empresa" placeholder="Ex.: MCorp Tecnologia" />
      <BaseInput id="email" v-model="email" label="E-mail" type="email" />
      <BaseInput id="password" v-model="password" label="Senha" type="password" />
      <BaseInput id="confirmPassword" v-model="confirmPassword" label="Confirmar senha" type="password" />
      <BaseButton class="w-full" type="submit" :loading="loading" block>Criar minha empresa</BaseButton>
    </form>
    <p class="mt-6 text-center text-sm text-slate-500">
      Já tem conta?
      <RouterLink class="font-semibold text-primary hover:underline" to="/login">Entrar</RouterLink>
    </p>
  </section>
</template>
