import { computed, reactive, ref } from 'vue'
import { templateService } from '../services/templateService'
import type { CampoTemplate, EstruturaTemplate, RegraValidacao, Template, TipoCampo } from '../types'
import {
  emptyEstrutura,
  estruturaFromRegras,
  findCampo,
  flattenCampos,
  newId,
  parseEstrutura,
  uniqueIdentificador,
} from '../utils/estrutura'

export type StudioSelection =
  | { kind: 'geral' }
  | { kind: 'secao'; secaoId: string }
  | { kind: 'campo'; secaoId: string; campoId: string }

export function useTemplateStudio() {
  const template = ref<Template | null>(null)
  const estrutura = ref<EstruturaTemplate>(emptyEstrutura())
  const regras = ref<RegraValidacao[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const publishing = ref(false)
  const savedAt = ref<Date | null>(null)
  const dirty = ref(false)
  const error = ref('')
  const selected = ref<StudioSelection>({ kind: 'geral' })
  const info = reactive({ nome: '', descricao: '', categoria: '' })
  const wasPublished = ref(false)

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let canEdit = false

  const campos = computed(() => flattenCampos(estrutura.value))
  const selectedSecao = computed(() => {
    const sel = selected.value
    if (sel.kind === 'geral') return undefined
    return estrutura.value.secoes.find((secao) => secao.id === sel.secaoId)
  })
  const selectedCampo = computed(() => {
    const sel = selected.value
    if (sel.kind !== 'campo') return undefined
    return findCampo(estrutura.value, sel.campoId)?.campo
  })

  function setEditable(value: boolean) {
    canEdit = value
  }

  function markDirty() {
    if (!canEdit) return
    dirty.value = true
    scheduleSave()
  }

  function scheduleSave() {
    if (!canEdit) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { void persist() }, 700)
  }

  async function persist() {
    if (!template.value || !canEdit) return
    saving.value = true
    error.value = ''
    try {
      const updated = await templateService.update(template.value.id, {
        nome: info.nome,
        descricao: info.descricao,
        categoria: info.categoria || undefined,
        estrutura: estrutura.value,
      })
      template.value = { ...template.value, ...updated, regras: regras.value }
      dirty.value = false
      savedAt.value = new Date()
    } catch (err) {
      error.value = 'Não foi possível salvar as alterações.'
      throw err
    } finally {
      saving.value = false
    }
  }

  async function reloadRules() {
    if (!template.value) return
    regras.value = await templateService.rules(template.value.id)
  }

  async function load(id: string) {
    loading.value = true
    error.value = ''
    try {
      const data = await templateService.get(id)
      template.value = data
      info.nome = data.nome
      info.descricao = data.descricao || ''
      info.categoria = data.categoria || ''
      regras.value = data.regras ?? await templateService.rules(id)
      wasPublished.value = data.status === 'ativo' || (data._count?.versoes ?? 0) > 0
      const parsed = parseEstrutura(data.estrutura)
      const hasCampos = (parsed?.secoes.some((secao) => secao.campos.length) ?? false)
      estrutura.value = hasCampos ? parsed! : (regras.value.length ? estruturaFromRegras(regras.value) : (parsed ?? emptyEstrutura()))
      if (canEdit && !hasCampos && flattenCampos(estrutura.value).length) {
        dirty.value = true
        await persist()
      }
      await dedupeRequiredRules()
      selected.value = { kind: 'geral' }
    } catch {
      error.value = 'Não foi possível abrir o template.'
      template.value = null
    } finally {
      loading.value = false
    }
  }

  function selectGeral() {
    selected.value = { kind: 'geral' }
  }

  function selectSecao(secaoId: string) {
    selected.value = { kind: 'secao', secaoId }
  }

  function selectCampo(secaoId: string, campoId: string) {
    selected.value = { kind: 'campo', secaoId, campoId }
  }

  function addSecao() {
    const secao = { id: newId(), nome: `Seção ${estrutura.value.secoes.length + 1}`, campos: [] as CampoTemplate[] }
    estrutura.value.secoes.push(secao)
    selectSecao(secao.id)
    markDirty()
  }

  function removeSecao(secaoId: string) {
    const secao = estrutura.value.secoes.find((item) => item.id === secaoId)
    const ids = secao?.campos.map((campo) => campo.identificador) ?? []
    estrutura.value.secoes = estrutura.value.secoes.filter((item) => item.id !== secaoId)
    if (!estrutura.value.secoes.length) estrutura.value = emptyEstrutura()
    selected.value = { kind: 'geral' }
    markDirty()
    void removeRulesForCampos(ids)
  }

  function updateSecao(secaoId: string, nome: string) {
    const secao = estrutura.value.secoes.find((item) => item.id === secaoId)
    if (!secao) return
    secao.nome = nome
    markDirty()
  }

  function moveSecao(fromIndex: number, toIndex: number) {
    const list = estrutura.value.secoes
    if (toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return
    const [item] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, item)
    markDirty()
  }

  function addCampo(secaoId?: string, tipo: TipoCampo = 'texto') {
    const secao = estrutura.value.secoes.find((item) => item.id === secaoId) ?? estrutura.value.secoes[0]
    if (!secao) {
      addSecao()
      return addCampo(estrutura.value.secoes[0].id, tipo)
    }
    const nome = 'Novo campo'
    const campo: CampoTemplate = {
      id: newId(),
      nome,
      identificador: uniqueIdentificador(estrutura.value, nome),
      tipo,
      obrigatorio: false,
      descricao: '',
      valorPadrao: '',
    }
    secao.campos.push(campo)
    selectCampo(secao.id, campo.id)
    markDirty()
    return campo
  }

  async function removeCampo(secaoId: string, campoId: string) {
    const secao = estrutura.value.secoes.find((item) => item.id === secaoId)
    const campo = secao?.campos.find((item) => item.id === campoId)
    if (!secao || !campo) return
    secao.campos = secao.campos.filter((item) => item.id !== campoId)
    selected.value = { kind: 'secao', secaoId }
    markDirty()
    await removeRulesForCampos([campo.identificador])
  }

  async function updateCampo(secaoId: string, campoId: string, patch: Partial<CampoTemplate>) {
    const found = findCampo(estrutura.value, campoId)
    if (!found || found.secao.id !== secaoId) return
    const previous = found.campo.identificador
    if (patch.identificador) {
      patch.identificador = uniqueIdentificador(estrutura.value, patch.identificador, campoId)
    }
    Object.assign(found.campo, patch)
    markDirty()
    if (patch.identificador && patch.identificador !== previous) {
      await renameIdentificadorInRules(previous, found.campo.identificador)
    }
    if (patch.obrigatorio !== undefined) {
      await syncRequiredRule(found.campo)
    }
  }

  function moveCampo(fromSecaoId: string, campoId: string, toSecaoId: string, toIndex: number) {
    const from = estrutura.value.secoes.find((item) => item.id === fromSecaoId)
    const to = estrutura.value.secoes.find((item) => item.id === toSecaoId)
    if (!from || !to) return
    const fromIndex = from.campos.findIndex((item) => item.id === campoId)
    if (fromIndex < 0) return
    const [campo] = from.campos.splice(fromIndex, 1)
    const index = Math.max(0, Math.min(toIndex, to.campos.length))
    to.campos.splice(index, 0, campo)
    selectCampo(toSecaoId, campoId)
    markDirty()
  }

  async function renameIdentificadorInRules(from: string, to: string) {
    if (!template.value || from === to) return
    for (const regra of regras.value) {
      const params = { ...regra.parametros }
      let changed = false
      if (params.campo === from) { params.campo = to; changed = true }
      if (params.campo_resultado === from) { params.campo_resultado = to; changed = true }
      if (typeof params.expressao === 'string' && params.expressao.includes(from)) {
        params.expressao = String(params.expressao).split(from).join(to)
        changed = true
      }
      if (changed) await templateService.updateRule(regra.id, { parametros: params })
    }
    await reloadRules()
  }

  async function removeRulesForCampos(identificadores: string[]) {
    if (!identificadores.length) return
    for (const regra of [...regras.value]) {
      const campo = String(regra.parametros?.campo ?? '')
      const resultado = String(regra.parametros?.campo_resultado ?? '')
      if (identificadores.includes(campo) || identificadores.includes(resultado)) {
        await templateService.removeRule(regra.id)
      }
    }
    await reloadRules()
  }

  async function syncRequiredRule(campo: CampoTemplate) {
    if (!template.value) return
    const existing = regras.value.find((regra) => regra.tipo === 'campo_obrigatorio' && regra.parametros?.campo === campo.identificador)
    if (campo.obrigatorio && !existing) {
      await templateService.createRule(template.value.id, {
        nome: `${campo.nome} é obrigatório`,
        tipo: 'campo_obrigatorio',
        parametros: { campo: campo.identificador },
        obrigatoria: true,
      })
      await reloadRules()
    }
    if (!campo.obrigatorio && existing) {
      await templateService.removeRule(existing.id)
      await reloadRules()
    }
  }

  async function saveRule(payload: Partial<RegraValidacao>, existingId?: string) {
    if (!template.value) return
    let id = existingId
    if (payload.tipo === 'campo_obrigatorio' && !id) {
      const campo = String(payload.parametros?.campo ?? '')
      const dup = regras.value.find((regra) => regra.tipo === 'campo_obrigatorio' && regra.parametros?.campo === campo)
      if (dup) id = dup.id
    }
    if (id) await templateService.updateRule(id, payload)
    else await templateService.createRule(template.value.id, payload)
    await reloadRules()
    if (payload.tipo === 'campo_obrigatorio' && payload.parametros?.campo) {
      const found = campos.value.find((campo) => campo.identificador === payload.parametros?.campo)
      if (found) found.obrigatorio = true
      markDirty()
    }
  }

  async function dedupeRequiredRules() {
    if (!canEdit) return
    const extras: string[] = []
    const seen = new Set<string>()
    for (const regra of regras.value) {
      if (regra.tipo !== 'campo_obrigatorio') continue
      const campo = String(regra.parametros?.campo ?? '')
      if (!campo) continue
      if (seen.has(campo)) extras.push(regra.id)
      else seen.add(campo)
    }
    if (!extras.length) return
    for (const id of extras) await templateService.removeRule(id)
    await reloadRules()
  }

  async function removeRule(id: string) {
    const regra = regras.value.find((item) => item.id === id)
    await templateService.removeRule(id)
    await reloadRules()
    if (regra?.tipo === 'campo_obrigatorio') {
      const found = campos.value.find((campo) => campo.identificador === regra.parametros?.campo)
      if (found) found.obrigatorio = false
      markDirty()
    }
  }

  async function publish() {
    if (!template.value) return
    if (dirty.value) await persist()
    publishing.value = true
    try {
      const result = await templateService.publish(template.value.id)
      await load(template.value.id)
      return result
    } finally {
      publishing.value = false
    }
  }

  function dispose() {
    clearTimeout(saveTimer)
  }

  function updateInfo(patch: Partial<{ nome: string; descricao: string; categoria: string }>) {
    Object.assign(info, patch)
    markDirty()
  }

  return {
    template,
    estrutura,
    regras,
    loading,
    saving,
    publishing,
    savedAt,
    dirty,
    error,
    selected,
    info,
    wasPublished,
    campos,
    selectedSecao,
    selectedCampo,
    setEditable,
    load,
    persist,
    updateInfo,
    selectGeral,
    selectSecao,
    selectCampo,
    addSecao,
    removeSecao,
    updateSecao,
    moveSecao,
    addCampo,
    removeCampo,
    updateCampo,
    moveCampo,
    saveRule,
    removeRule,
    publish,
    dispose,
  }
}
