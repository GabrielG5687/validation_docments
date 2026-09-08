<script setup lang="ts">
import { useConnection } from '../../composables/useConnection'
const { isOnline } = useConnection()
</script>
<template><div v-if="!isOnline" class="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900" role="status">Sem conexão com o servidor. Você ainda pode navegar.</div></template>
