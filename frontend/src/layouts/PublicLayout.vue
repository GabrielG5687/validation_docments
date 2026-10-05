<template>
  <main class="min-h-screen bg-surface px-4 py-10">
    <div class="mx-auto max-w-3xl">
      <RouterLink to="/login" class="mb-8 inline-flex items-center" aria-label="ValidaDoc">
        <BrandLogo size="md" />
      </RouterLink>
      <RouterView />
    </div>
  </main>
</template>

<script setup lang="ts">
import BrandLogo from '../components/common/BrandLogo.vue'
</script>
