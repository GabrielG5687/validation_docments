import { extrairCampos } from './pdfService'
import { recortarTextoRelevante, type PaginaTexto } from './extracao/evidenciaService'
import { extrairEAnalisarDocumento, isGroqConfigured, GroqConfigError } from './groqService'
import type { IaExtracaoStatus } from './extracao/resolverCandidatos'

const IA_MAX_RETRIES = 2
const IA_TIMEOUT_MS = 45_000

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo limite de extração excedido')), milliseconds)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) }
    )
  })
}

async function chamarIaComRetry<T>(
  fn: () => Promise<T>,
  contexto: { documentoId?: string; operacao: string }
): Promise<{ sucesso: boolean; dados?: T; erro?: string; iaStatus: IaExtracaoStatus }> {
  if (!isGroqConfigured()) {
    return { sucesso: false, erro: 'GROQ_API_KEY não configurada', iaStatus: 'nao_configurada' }
  }

  let lastError: Error | undefined
  for (let attempt = 1; attempt <= IA_MAX_RETRIES; attempt++) {
    try {
      const dados = await withTimeout(fn(), IA_TIMEOUT_MS)
      if (attempt > 1) {
        console.info('[IA] Sucesso na tentativa', { attempt, ...contexto })
      }
      return { sucesso: true, dados, iaStatus: 'sucesso' }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const message = lastError.message
      console.warn('[IA] Tentativa falhou', { attempt, max: IA_MAX_RETRIES, message, ...contexto })
      
      if (attempt === IA_MAX_RETRIES) {
        let iaStatus: IaExtracaoStatus = 'indisponivel'
        if (/tempo limite|timeout|aborted/i.test(message)) iaStatus = 'timeout'
        else if (error instanceof GroqConfigError) iaStatus = 'nao_configurada'
        
        return { 
          sucesso: false, 
          erro: message, 
          iaStatus 
        }
      }
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
  return { sucesso: false, erro: lastError?.message, iaStatus: 'indisponivel' }
}

export function onlyFilled(record: Record<string, string | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    const text = typeof value === 'string' ? value.trim() : ''
    if (text) out[key] = text
  }
  return out
}

export async function extrairValoresDeDocumento(opts: {
  texto: string
  chaves: string[]
  rotulos?: Record<string, string>
  regras: Array<{ nome: string; tipo: string; parametros: unknown }>
  documentoId?: string
  descricaoTemplate?: string
}): Promise<{ valores: Record<string, string>; resumo?: string; iaStatus: IaExtracaoStatus }> {
  const { texto, chaves, rotulos = {}, regras, documentoId, descricaoTemplate } = opts
  const uniqueChaves = [...new Set(chaves.filter(Boolean))]
  const aliases = [...new Set(uniqueChaves.flatMap((chave) => [chave, rotulos[chave]].filter(Boolean)))]
  const bruto = extrairCampos(texto, aliases)

  const valores: Record<string, string> = {}
  for (const chave of uniqueChaves) {
    const found = bruto[chave] || (rotulos[chave] ? bruto[rotulos[chave]] : undefined)
    if (found?.trim()) valores[chave] = found.trim()
  }

  let resumo: string | undefined
  let iaStatus: IaExtracaoStatus = 'nao_aplicada'

  if (uniqueChaves.length > 0 && texto.trim()) {
    const resultado = await chamarIaComRetry(
      () => extrairEAnalisarDocumento(texto, uniqueChaves, regras, rotulos, descricaoTemplate),
      { documentoId, operacao: 'extrairValoresDeDocumento' }
    )
    iaStatus = resultado.iaStatus
    if (resultado.sucesso && resultado.dados) {
      const analise = resultado.dados
      for (const [campo, valor] of Object.entries(analise.campos)) {
        if (!valores[campo] && valor) valores[campo] = valor
      }
      for (const chave of uniqueChaves) {
        const rotulo = rotulos[chave]
        if (!valores[chave] && rotulo && analise.campos[rotulo]) {
          valores[chave] = analise.campos[rotulo]
        }
      }
      resumo = analise.resumo || undefined
    } else if (!resultado.sucesso) {
      console.warn('[Extracao] IA falhou após retentativas', { documentoId, erro: resultado.erro, iaStatus })
    }
  }

  return { valores, resumo, iaStatus }
}

export async function extrairCamadas(opts: {
  paginas: PaginaTexto[]
  chaves: string[]
  rotulos?: Record<string, string>
  regras: Array<{ nome: string; tipo: string; parametros: unknown }>
  documentoId?: string
  descricaoTemplate?: string
}): Promise<{
  regex: Record<string, string>
  ia: Record<string, string>
  resumo?: string
  iaStatus: IaExtracaoStatus
}> {
  const { paginas, chaves, rotulos = {}, regras, documentoId, descricaoTemplate } = opts
  const texto = paginas.map((pagina) => pagina.texto).join('\n')
  const uniqueChaves = [...new Set(chaves.filter(Boolean))]
  const aliases = [...new Set(uniqueChaves.flatMap((chave) => [chave, rotulos[chave]].filter(Boolean)))]
  const bruto = extrairCampos(texto, aliases)
  const regex: Record<string, string> = {}
  for (const chave of uniqueChaves) {
    const found = bruto[chave] || (rotulos[chave] ? bruto[rotulos[chave]] : undefined)
    if (found?.trim()) regex[chave] = found.trim()
  }

  if (!uniqueChaves.length || !texto.trim()) {
    return { regex, ia: {}, iaStatus: 'nao_aplicada' }
  }

  const recorte = recortarTextoRelevante(paginas, [...aliases, ...Object.values(rotulos)])
  const resultado = await chamarIaComRetry(
    () => extrairEAnalisarDocumento(recorte, uniqueChaves, regras, rotulos, descricaoTemplate),
    { documentoId, operacao: 'extrairCamadas' }
  )

  const iaStatus = resultado.iaStatus
  const ia: Record<string, string> = {}

  if (resultado.sucesso && resultado.dados) {
    const analise = resultado.dados
    for (const chave of uniqueChaves) {
      const direto = analise.campos[chave]
      const peloRotulo = rotulos[chave] ? analise.campos[rotulos[chave]] : undefined
      const valor = (direto || peloRotulo || '').trim()
      if (valor) ia[chave] = valor
    }
    return {
      regex,
      ia,
      resumo: analise.resumo || undefined,
      iaStatus,
    }
  }

  console.warn('[Extracao] IA falhou após retentativas', { documentoId, erro: resultado.erro, iaStatus })
  return { regex, ia: {}, iaStatus }
}
