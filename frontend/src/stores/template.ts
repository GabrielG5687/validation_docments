import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RegraValidacao, Template } from '../types'
import { templateService } from '../services/templateService'

export const useTemplateStore = defineStore('template', () => {
  const templates = ref<Template[]>([])
  const regras = ref<RegraValidacao[]>([])
  const loading = ref(false)

  async function list(status?: string) {
    loading.value = true
    try {
      templates.value = await templateService.list(status)
      return templates.value
    } finally {
      loading.value = false
    }
  }

  async function loadRules(id: string) {
    regras.value = await templateService.rules(id)
    return regras.value
  }

  return {
    templates,
    regras,
    loading,
    list,
    loadRules,
    get: templateService.get,
    create: templateService.create,
    update: templateService.update,
    remove: templateService.remove,
    publish: templateService.publish,
    createRule: templateService.createRule,
    updateRule: templateService.updateRule,
    removeRule: templateService.removeRule,
  }
})
