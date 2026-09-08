<script setup lang="ts">
import { ChevronDown, ChevronRight, FileText, FolderOpen, GripVertical, Plus, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'
import type { SecaoTemplate } from '../../types'

const props = defineProps<{
  secoes: SecaoTemplate[]
  selectedKind: string
  selectedSecaoId?: string
  selectedCampoId?: string
  readOnly?: boolean
}>()

const emit = defineEmits<{
  selectSecao: [id: string]
  selectCampo: [secaoId: string, campoId: string]
  addSecao: []
  addCampo: [secaoId?: string]
  addRegra: []
  removeSecao: [id: string]
  removeCampo: [secaoId: string, campoId: string]
  moveSecao: [from: number, to: number]
  moveCampo: [fromSecaoId: string, campoId: string, toSecaoId: string, toIndex: number]
}>()

const collapsed = ref<Record<string, boolean>>({})
const dragging = ref<{ kind: 'secao' | 'campo'; secaoId: string; campoId?: string; index: number }>()

function toggle(id: string) {
  collapsed.value[id] = !collapsed.value[id]
}

function onSecaoDragStart(index: number, secaoId: string, event: DragEvent) {
  if (props.readOnly) return
  dragging.value = { kind: 'secao', secaoId, index }
  event.dataTransfer?.setData('text/plain', secaoId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onCampoDragStart(secaoId: string, campoId: string, index: number, event: DragEvent) {
  if (props.readOnly) return
  dragging.value = { kind: 'campo', secaoId, campoId, index }
  event.dataTransfer?.setData('text/plain', campoId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onSecaoDrop(index: number) {
  if (props.readOnly || dragging.value?.kind !== 'secao') return
  emit('moveSecao', dragging.value.index, index)
  dragging.value = undefined
}

function onCampoDrop(secaoId: string, index: number) {
  if (props.readOnly || dragging.value?.kind !== 'campo' || !dragging.value.campoId) return
  emit('moveCampo', dragging.value.secaoId, dragging.value.campoId, secaoId, index)
  dragging.value = undefined
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Estrutura</p>
        <p class="text-sm font-semibold text-slate-800">Documento</p>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto p-2">
      <div
        v-for="(secao, secaoIndex) in secoes"
        :key="secao.id"
        class="mb-1 rounded-lg"
        @dragover.prevent
        @drop.prevent="onSecaoDrop(secaoIndex)"
      >
        <div
          class="group flex items-center gap-1 rounded-lg px-1 py-1.5"
          :class="selectedKind === 'secao' && selectedSecaoId === secao.id ? 'bg-primary-light text-primary' : 'hover:bg-slate-100'"
        >
          <button
            v-if="!readOnly"
            type="button"
            class="cursor-grab p-0.5 text-slate-400 hover:text-slate-600"
            draggable="true"
            aria-label="Reordenar seção"
            @dragstart="onSecaoDragStart(secaoIndex, secao.id, $event)"
          >
            <GripVertical class="h-4 w-4" />
          </button>
          <button type="button" class="p-0.5 text-slate-400" @click="toggle(secao.id)">
            <ChevronDown v-if="!collapsed[secao.id]" class="h-4 w-4" />
            <ChevronRight v-else class="h-4 w-4" />
          </button>
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold" @click="emit('selectSecao', secao.id)">
            <FolderOpen class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ secao.nome }}</span>
            <span class="text-xs font-normal text-slate-400">{{ secao.campos.length }}</span>
          </button>
          <button
            v-if="!readOnly"
            type="button"
            class="hidden rounded p-1 text-slate-400 hover:bg-white hover:text-red-600 group-hover:block"
            aria-label="Excluir seção"
            @click="emit('removeSecao', secao.id)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
        <div v-if="!collapsed[secao.id]" class="ml-6 border-l border-slate-200 pl-1">
          <div
            v-for="(campo, campoIndex) in secao.campos"
            :key="campo.id"
            class="group flex items-center gap-1 rounded-md px-1 py-1"
            :class="selectedCampoId === campo.id ? 'bg-primary-light text-primary' : 'hover:bg-slate-50'"
            @dragover.prevent
            @drop.prevent="onCampoDrop(secao.id, campoIndex)"
          >
            <button
              v-if="!readOnly"
              type="button"
              class="cursor-grab p-0.5 text-slate-300 hover:text-slate-500"
              draggable="true"
              aria-label="Reordenar campo"
              @dragstart="onCampoDragStart(secao.id, campo.id, campoIndex, $event)"
            >
              <GripVertical class="h-3.5 w-3.5" />
            </button>
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" @click="emit('selectCampo', secao.id, campo.id)">
              <FileText class="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span class="truncate">{{ campo.nome }}</span>
              <span v-if="campo.obrigatorio" class="text-[10px] font-semibold text-amber-600">*</span>
            </button>
            <button
              v-if="!readOnly"
              type="button"
              class="hidden rounded p-1 text-slate-400 hover:text-red-600 group-hover:block"
              aria-label="Excluir campo"
              @click="emit('removeCampo', secao.id, campo.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            v-if="!readOnly"
            type="button"
            class="mt-1 flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:underline"
            @click="emit('addCampo', secao.id)"
          >
            <Plus class="h-3 w-3" /> Campo
          </button>
          <div
            class="h-4"
            @dragover.prevent
            @drop.prevent="onCampoDrop(secao.id, secao.campos.length)"
          />
        </div>
      </div>
      <p v-if="!secoes.length" class="px-3 py-6 text-center text-sm text-slate-500">Nenhuma seção ainda.</p>
    </div>
    <div v-if="!readOnly" class="grid grid-cols-3 gap-2 border-t border-slate-200 p-3">
      <button type="button" class="rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" @click="emit('addSecao')">
        + Seção
      </button>
      <button type="button" class="rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" @click="emit('addCampo')">
        + Campo
      </button>
      <button type="button" class="rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-white hover:bg-primary-hover" @click="emit('addRegra')">
        + Regra
      </button>
    </div>
  </div>
</template>
