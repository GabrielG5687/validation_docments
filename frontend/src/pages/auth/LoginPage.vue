<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { useAuthStore } from '../../stores/auth'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'
import BrandLogo from '../../components/common/BrandLogo.vue'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()
const route = useRoute()
const auth = useAuth()
const authStore = useAuthStore()

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.loginComEmail(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    await router.push(redirect || authStore.destinoInicial)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'E-mail ou senha inválidos.'
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
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Bem-vindo de volta</h1>
      <p class="mt-1.5 text-sm text-slate-500">Acesse sua conta para continuar</p>
    </div>
    <BaseAlert v-if="error" type="error" :message="error" class="mb-4" />
    <form class="space-y-4" @submit.prevent="submit">
      <BaseInput id="email" v-model="email" label="E-mail" type="email" placeholder="seu@email.com" />
      <BaseInput id="password" v-model="password" label="Senha" type="password" placeholder="••••••••" />
      <BaseButton class="w-full" type="submit" :loading="loading" block>Entrar</BaseButton>
    </form>
    <p class="mt-6 text-center text-sm text-slate-500">
      Não tem conta?
      <RouterLink class="font-semibold text-primary hover:underline" to="/cadastro">Criar organização</RouterLink>
    </p>
  </section>
</template>
