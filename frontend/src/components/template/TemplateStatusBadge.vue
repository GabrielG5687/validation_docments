<script setup lang="ts">
import { templateBadge } from '../../utils/templateStatus'
import type { Template } from '../../types'

const props = defineProps<{ template: Pick<Template, 'status' | '_count'> }>()
const badge = templateBadge(props.template)
</script>

<template>
  <span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', badge.className]">
    {{ badge.label }}
  </span>
</template>
