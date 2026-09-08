<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
onMounted(() => router.replace('/login'))
</script>
<template><div class="rounded-xl bg-white p-8 text-center shadow">Redirecionando…</div></template>
