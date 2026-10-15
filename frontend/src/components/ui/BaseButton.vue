<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'; loading?: boolean; type?: 'button' | 'submit' | 'reset' }>(),
  { variant: 'primary', loading: false, type: 'button' },
)
</script>
<template>
  <button
    :type="type"
    :disabled="loading"
    :class="[
      'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
      {
        'bg-primary text-white hover:bg-primary-hover': variant === 'primary',
        'border border-line bg-white text-ink hover:bg-canvas': variant === 'secondary',
        'bg-emerald-600 text-white hover:bg-emerald-700': variant === 'success',
        'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
        'text-ink-muted hover:bg-canvas hover:text-ink': variant === 'ghost',
      },
    ]"
  >
    <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    <slot />
  </button>
</template>
