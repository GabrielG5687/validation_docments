<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import BaseInput from '../../components/ui/BaseInput.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseAlert from '../../components/ui/BaseAlert.vue'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()
const route = useRoute()
const auth = useAuth()

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.loginComEmail(email.value, password.value)
    await router.push(String(route.query.redirect || '/dashboard'))
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'E-mail ou senha inválidos.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
    <div class="mb-8 text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-white">✓</div>
      <h1 class="text-2xl font-bold">Acesse o DocValid</h1>
      <p class="mt-1 text-sm text-slate-600">Validação documental segura e rastreável</p>
    </div>
    <BaseAlert v-if="error" type="error" :message="error" class="mb-4" />
    <form class="space-y-4" @submit.prevent="submit">
      <BaseInput id="email" v-model="email" label="E-mail" type="email" />
      <BaseInput id="password" v-model="password" label="Senha" type="password" />
      <BaseButton class="w-full" type="submit" :loading="loading">Entrar</BaseButton>
    </form>
    <p class="mt-5 text-center text-sm text-slate-600">
      Não tem conta?
      <RouterLink class="font-semibold text-primary hover:underline" to="/cadastro">Cadastre-se</RouterLink>
    </p>
  </section>
</template>
