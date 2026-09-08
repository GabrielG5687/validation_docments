<script setup lang="ts">
import { Check } from 'lucide-vue-next'

withDefaults(defineProps<{ compact?: boolean; label?: string }>(), {
  compact: false,
  label: 'OK',
})
</script>

<template>
  <div
    class="pointer-events-none select-none"
    :class="compact ? 'h-16 w-16' : 'h-28 w-28'"
    aria-label="Selo de documento aprovado"
  >
    <div
      class="flex h-full w-full -rotate-12 flex-col items-center justify-center rounded-full border-[5px] border-green-600 bg-green-50/90 text-green-700 shadow-lg ring-2 ring-green-600/30"
    >
      <Check :class="compact ? 'h-5 w-5' : 'h-8 w-8'" stroke-width="3" aria-hidden="true" />
      <span class="font-black tracking-widest" :class="compact ? 'text-[10px]' : 'text-sm'">{{ label }}</span>
      <span v-if="!compact" class="text-[9px] font-bold uppercase tracking-wider">Aprovado</span>
    </div>
  </div>
</template>
