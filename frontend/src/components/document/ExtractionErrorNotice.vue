<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ error?: unknown }>()

const message = computed(() => {
  const error = typeof props.error === 'string' ? props.error : ''
  if (/sem texto selecion[aá]vel/i.test(error)) {
    return 'Não foi possível identificar texto neste PDF. Se o arquivo foi digitalizado, envie uma versão com reconhecimento de texto (OCR) ou um PDF com texto selecionável.'
  }

  return 'Não foi possível concluir a leitura deste documento. Confira se o arquivo está íntegro e tente enviá-lo novamente. Se o problema continuar, entre em contato com o suporte.'
})
</script>

<template>
  <div role="alert" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <p class="font-semibold">Não foi possível processar o documento</p>
    <p class="mt-1">{{ message }}</p>
  </div>
</template>
