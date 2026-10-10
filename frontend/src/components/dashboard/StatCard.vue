<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string; tone?: string }>()
</script>
<template>
  <div class="card flex items-start justify-between gap-3 !p-4">
    <div>
      <p class="text-sm text-ink-muted">{{ label }}</p>
      <p class="mt-1 text-3xl font-semibold tracking-tight" :class="tone || 'text-ink'">{{ value }}</p>
      <p v-if="hint" class="mt-1 text-xs text-ink-muted">{{ hint }}</p>
    </div>
    <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
      <slot name="icon" />
    </div>
  </div>
</template>
