<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { templateService } from '../../services/templateService'
import { formatDate } from '../../utils/formatDate'
import { describeRegra } from '../../utils/regraCopy'
import { countCampos } from '../../utils/estrutura'
import type { TemplateVersao } from '../../types'
import BaseSpinner from '../../components/ui/BaseSpinner.vue'
import BaseButton from '../../components/ui/BaseButton.vue'

const route = useRoute()
const versions = ref<TemplateVersao[]>([])
const loading = ref(true)
const leftId = ref('')
const rightId = ref('')
const comparing = ref(false)

onMounted(async () => {
  try {
    versions.value = await templateService.versions(String(route.params.id))
    if (versions.value[0]) leftId.value = versions.value[0].id
    if (versions.value[1]) rightId.value = versions.value[1].id
  } finally {
    loading.value = false
  }
})

const left = computed(() => versions.value.find((item) => item.id === leftId.value))
const right = computed(() => versions.value.find((item) => item.id === rightId.value))

function regras(version?: TemplateVersao) {
  return version?.snapshot?.regras ?? []
}

function camposCount(version?: TemplateVersao) {
  return version?.numCampos ?? countCampos(version?.snapshot?.estrutura)
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="muted">Histórico</p>
        <h1 class="page-title">Versões e histórico</h1>
      </div>
      <RouterLink :to="`/templates/${route.params.id}`" class="text-sm font-semibold text-primary">Voltar ao editor</RouterLink>
    </div>
    <BaseSpinner v-if="loading" />
    <template v-else>
      <div class="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Versão</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Publicada em</th>
              <th class="px-4 py-3">Campos</th>
              <th class="px-4 py-3">Regras</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(version, index) in versions" :key="version.id" class="border-t border-slate-100">
              <td class="px-4 py-3 font-semibold">v{{ version.versao }}</td>
              <td class="px-4 py-3">
                <span :class="index === 0 ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'">
                  {{ index === 0 ? 'Ativo' : 'Arquivado' }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ formatDate(version.publicadoEm) }}</td>
              <td class="px-4 py-3">{{ camposCount(version) }}</td>
              <td class="px-4 py-3">{{ version.numRegras }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!versions.length" class="px-4 py-8 text-center text-sm text-slate-500">Nenhuma versão publicada.</p>
      </div>

      <section v-if="versions.length >= 2" class="card">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 class="text-lg font-bold">Comparar versões</h2>
          <div class="flex flex-wrap items-center gap-2">
            <select v-model="leftId" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option v-for="version in versions" :key="version.id" :value="version.id">v{{ version.versao }}</option>
            </select>
            <span class="text-slate-400">×</span>
            <select v-model="rightId" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option v-for="version in versions" :key="version.id" :value="version.id">v{{ version.versao }}</option>
            </select>
            <BaseButton variant="secondary" @click="comparing = true">Comparar</BaseButton>
          </div>
        </div>
        <div v-if="comparing && left && right" class="grid gap-4 md:grid-cols-2">
          <article v-for="side in [left, right]" :key="side.id" class="rounded-lg border border-slate-200 p-4">
            <h3 class="mb-3 font-semibold">v{{ side.versao }}</h3>
            <p class="text-sm text-slate-600">{{ camposCount(side) }} campos · {{ side.numRegras }} regras</p>
            <ul class="mt-3 space-y-2 text-sm">
              <li v-for="regra in regras(side)" :key="regra.id" class="rounded-md bg-slate-50 px-3 py-2">
                <p class="font-medium">{{ regra.nome }}</p>
                <p class="text-slate-600">{{ describeRegra(regra) }}</p>
              </li>
            </ul>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
