<script setup lang="ts">
import logoUrl from '../../img/logo.png'

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)
</script>

<template>
  <img
    :src="logoUrl"
    alt="ValidaDoc — Plataforma de Validação Documental"
    class="block w-auto max-w-none object-contain object-left"
    :class="{
      'h-7': size === 'sm',
      'h-9': size === 'md',
      'h-[4.2rem]': size === 'lg',
    }"
  />
</template>
