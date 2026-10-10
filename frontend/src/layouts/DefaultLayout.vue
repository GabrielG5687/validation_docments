<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/common/AppHeader.vue'
import AppSidebar from '../components/common/AppSidebar.vue'
import ConnectionBanner from '../components/common/ConnectionBanner.vue'
import { useAuthStore } from '../stores/auth'
const menuOpen = ref(false)
const route = useRoute()
const auth = useAuthStore()
const studio = computed(() => Boolean(route.meta.studio))
const viewKey = computed(() => `${route.fullPath}::${auth.empresaAtivaId || 'none'}`)
</script>
<template>
  <div class="flex min-h-screen bg-canvas">
    <AppSidebar :open="menuOpen" @close="menuOpen = false" />
    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader @toggle="menuOpen = !menuOpen" />
      <ConnectionBanner />
      <main :class="['min-w-0 flex-1', studio ? 'overflow-hidden p-0' : 'px-4 py-6 lg:px-8 lg:py-7']">
        <RouterView :key="viewKey" />
      </main>
    </div>
  </div>
</template>
