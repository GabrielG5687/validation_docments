<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTemplateStore } from '../../stores/template'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notification'
import { templateService } from '../../services/templateService'
import RuleList from '../../components/template/RuleList.vue'
import RuleEditor from '../../components/template/RuleEditor.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileDropzone from '../../components/upload/FileDropzone.vue'
import type { AnaliseIa, RegraValidacao } from '../../types'

const route = useRoute()
const store = useTemplateStore()
const auth = useAuthStore()
const notifications = useNotificationStore()
const editing = ref<RegraValidacao>()
const showEditor = ref(false)
const analyzing = ref(false)
const analysis = ref<AnaliseIa>()
const analysisFile = ref<File>()
const analysisError = ref('')
const adding = ref<string>()

onMounted(() => store.loadRules(String(route.params.id)))

async function save(rule: Partial<RegraValidacao>) {
  if (editing.value) await store.updateRule(editing.value.id, rule)
  else await store.createRule(String(route.params.id), rule)
  await store.loadRules(String(route.params.id))
  showEditor.value = false
  editing.value = undefined
}

async function remove(rule: RegraValidacao) {
  if (confirm(`Excluir a regra "${rule.nome}"?`)) {
    await store.removeRule(rule.id)
    await store.loadRules(String(route.params.id))
  }
}

async function analyze() {
  analyzing.value = true
  analysisError.value = ''
  try {
    analysis.value = await templateService.analyzeWithAi(String(route.params.id), analysisFile.value)
  } catch (error: unknown) {
    const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
    analysisError.value = message || 'Não foi possível analisar o template.'
  } finally {
    analyzing.value = false
  }
}

async function addSuggested(rule: NonNullable<AnaliseIa['regrasSugeridas']>[number]) {
  adding.value = rule.nome
  try {
    await store.createRule(String(route.params.id), {
      nome: rule.nome,
      tipo: rule.tipo,
      parametros: rule.parametros,
      obrigatoria: rule.obrigatoria,
    })
    await store.loadRules(String(route.params.id))
    notifications.push({ type: 'success', message: `Regra "${rule.nome}" adicionada.` })
    analysis.value = {
      ...analysis.value!,
      regrasSugeridas: analysis.value?.regrasSugeridas?.filter((item) => item.nome !== rule.nome),
    }
  } catch {
    // interceptor
  } finally {
    adding.value = undefined
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 class="page-title">Editor de regras</h1>
      <div class="flex gap-2">
        <BaseButton v-if="auth.perfil === 'admin'" variant="secondary" :loading="analyzing" @click="analyze">Analisar com IA</BaseButton>
        <BaseButton @click="editing = undefined; showEditor = true">Nova regra</BaseButton>
      </div>
    </div>
    <div v-if="auth.perfil === 'admin'" class="card mb-6 space-y-3">
      <h2 class="text-lg font-bold">Ajuda da IA</h2>
      <p class="text-sm text-slate-600">Analisa as regras atuais. Envie um PDF opcional para comparar com um documento de exemplo.</p>
      <FileDropzone @select="analysisFile = $event; analysisError = ''" @error="analysisError = $event" />
      <p v-if="analysisFile" class="text-sm text-green-700">Selecionado: {{ analysisFile.name }}</p>
      <p v-if="analysisError" class="text-sm text-red-700">{{ analysisError }}</p>
      <div v-if="analysis" class="space-y-3 rounded-lg bg-slate-50 p-4 text-sm">
        <p v-if="analysis.resumo"><span class="font-semibold">Resumo:</span> {{ analysis.resumo }}</p>
        <ul v-if="analysis.alertas?.length" class="list-disc space-y-1 pl-5 text-amber-800">
          <li v-for="alerta in analysis.alertas" :key="alerta">{{ alerta }}</li>
        </ul>
        <div v-if="analysis.regrasSugeridas?.length" class="space-y-2">
          <p class="font-semibold">Regras sugeridas</p>
          <div v-for="rule in analysis.regrasSugeridas" :key="rule.nome" class="flex items-center justify-between gap-3 rounded border bg-white p-3">
            <div>
              <p class="font-medium">{{ rule.nome }}</p>
              <p class="text-xs text-slate-500">{{ rule.tipo }}</p>
            </div>
            <BaseButton :loading="adding === rule.nome" @click="addSuggested(rule)">Adicionar</BaseButton>
          </div>
        </div>
      </div>
    </div>
    <div class="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section class="card">
        <RuleList :rules="store.regras" @edit="editing = $event; showEditor = true" @remove="remove" />
      </section>
      <section v-if="showEditor" class="card">
        <RuleEditor :initial="editing" @save="save" @cancel="showEditor = false" />
      </section>
    </div>
  </div>
</template>
