<script setup lang="ts">
defineProps<{ loading?: boolean; empty?: string }>()
</script>
<template>
  <div class="surface overflow-x-auto">
    <table class="min-w-full text-left">
      <slot name="head" />
      <tbody class="divide-y divide-line">
        <tr v-if="loading">
          <td colspan="99"><div class="p-8 text-center text-sm text-ink-muted">Carregando…</div></td>
        </tr>
        <tr v-else-if="empty">
          <td colspan="99" class="p-10 text-center text-sm text-ink-muted">{{ empty }}</td>
        </tr>
        <slot v-else />
      </tbody>
    </table>
  </div>
</template>
