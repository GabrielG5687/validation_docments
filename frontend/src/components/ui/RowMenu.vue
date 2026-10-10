<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function close(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', close))
onUnmounted(() => document.removeEventListener('click', close))
</script>
<template>
  <div ref="root" class="relative inline-flex">
    <button
      type="button"
      class="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
      aria-label="Ações"
      :aria-expanded="open"
      @click.stop="open = !open"
    >
      <MoreHorizontal class="h-4 w-4" />
    </button>
    <div v-if="open" class="absolute right-0 top-9 z-20 min-w-[180px] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-pop" @click="open = false">
      <slot />
    </div>
  </div>
</template>
