<script setup lang="ts">
import UploadWizard from '../../components/upload/UploadWizard.vue'
</script>
<template>
  <div>
    <p class="muted">Novo envio</p>
    <h1 class="page-title mb-2">Enviar documento</h1>
    <p class="mb-6 max-w-xl text-sm text-ink-muted">
      Em três passos: escolha o PDF, selecione o modelo de validação e confirme. A análise começa logo após o envio.
    </p>
    <UploadWizard />
  </div>
</template>
