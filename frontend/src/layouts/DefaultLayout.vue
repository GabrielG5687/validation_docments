<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/common/AppHeader.vue'
import AppSidebar from '../components/common/AppSidebar.vue'
import ConnectionBanner from '../components/common/ConnectionBanner.vue'
const menuOpen = ref(false)
const route = useRoute()
const studio = computed(() => Boolean(route.meta.studio))
</script>
<template>
  <div class="min-h-screen">
    <AppHeader @toggle="menuOpen = !menuOpen" />
    <ConnectionBanner />
    <div class="flex min-h-[calc(100vh-4rem)]">
      <AppSidebar :open="menuOpen" />
      <main :class="['min-w-0 flex-1', studio ? 'overflow-hidden p-0' : 'p-4 lg:p-8']">
        <RouterView />
      </main>
    </div>
  </div>
</template>
