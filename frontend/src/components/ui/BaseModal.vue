<script setup lang="ts">
defineProps<{ open: boolean; title: string; description?: string }>()
defineEmits<{ close: [] }>()
</script>
<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @keydown.esc="$emit('close')"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-pop">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-ink">{{ title }}</h2>
            <p v-if="description" class="mt-1 text-sm text-ink-muted">{{ description }}</p>
          </div>
          <button class="rounded-lg px-2 text-xl leading-none text-ink-muted hover:bg-canvas" aria-label="Fechar" @click="$emit('close')">×</button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
