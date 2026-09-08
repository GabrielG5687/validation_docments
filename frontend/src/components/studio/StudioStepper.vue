<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { StudioStep } from '../../types'

const props = defineProps<{
  step: StudioStep
  steps: Array<{ id: StudioStep; label: string }>
}>()
const emit = defineEmits<{ 'update:step': [value: StudioStep] }>()

function indexOf(id: StudioStep) {
  return props.steps.findIndex((item) => item.id === id)
}
</script>

<template>
  <ol class="flex min-w-0 items-center gap-1 overflow-x-auto pb-1">
    <li v-for="(item, index) in steps" :key="item.id" class="flex items-center gap-1">
      <button
        type="button"
        class="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-medium transition"
        :class="step === item.id ? 'bg-primary text-white' : indexOf(step) > index ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
        @click="emit('update:step', item.id)"
      >
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
          :class="step === item.id ? 'bg-white/20' : indexOf(step) > index ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'"
        >
          <Check v-if="indexOf(step) > index" class="h-3 w-3" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="hidden whitespace-nowrap sm:inline">{{ item.label }}</span>
      </button>
      <span v-if="index < steps.length - 1" class="hidden h-px w-6 bg-slate-200 sm:block" />
    </li>
  </ol>
</template>
