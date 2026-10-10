<script setup lang="ts">
defineProps<{ kicker?: string; title: string; description?: string }>()
</script>
<template>
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <p v-if="kicker" class="text-xs font-semibold uppercase tracking-wide text-ink-muted">{{ kicker }}</p>
      <h1 class="page-title" :class="kicker ? 'mt-1' : ''">{{ title }}</h1>
      <p v-if="description" class="muted mt-1 max-w-2xl">{{ description }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
