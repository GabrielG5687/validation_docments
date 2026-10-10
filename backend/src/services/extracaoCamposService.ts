import { extrairCampos } from './pdfService'
import { recortarTextoRelevante, type PaginaTexto } from './extracao/evidenciaService'
import { extrairEAnalisarDocumento, isGroqConfigured } from './groqService'
import type { IaExtracaoStatus } from './extracao/resolverCandidatos'

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo limite de extração excedido')), milliseconds)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) }
    )
  })
}

export function onlyFilled(record: Record<string, string | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    const text = typeof value === 'string' ? value.trim() : ''
    if (text) out[key] = text
  }
  return out
}

/**
 * Extracts field values the same way document processing does:
 * regex aliases first, then Groq fills what is still missing.
 */
export async function extrairValoresDeDocumento(opts: {
  texto: string
  chaves: string[]
  rotulos?: Record<string, string>
  regras: Array<{ nome: string; tipo: string; parametros: unknown }>
}): Promise<{ valores: Record<string, string>; resumo?: string; alertas?: string[] }> {
  const { texto, chaves, rotulos = {}, regras } = opts
  const uniqueChaves = [...new Set(chaves.filter(Boolean))]
  const aliases = [...new Set(uniqueChaves.flatMap((chave) => [chave, rotulos[chave]].filter(Boolean)))]
  const bruto = extrairCampos(texto, aliases)

  const valores: Record<string, string> = {}
  for (const chave of uniqueChaves) {
    const found = bruto[chave] || (rotulos[chave] ? bruto[rotulos[chave]] : undefined)
    if (found?.trim()) valores[chave] = found.trim()
  }

  let resumo: string | undefined
  let alertas: string[] | undefined

  if (isGroqConfigured() && uniqueChaves.length > 0 && texto.trim()) {
    try {
      const analise = await withTimeout(
        extrairEAnalisarDocumento(texto, uniqueChaves, regras, rotulos),
        45_000
      )
      for (const [campo, valor] of Object.entries(analise.campos)) {
        if (!valores[campo] && valor) valores[campo] = valor
      }
      // Groq may return the human label as key — map back to identificador
      for (const chave of uniqueChaves) {
        const rotulo = rotulos[chave]
        if (!valores[chave] && rotulo && analise.campos[rotulo]) {
          valores[chave] = analise.campos[rotulo]
        }
      }
      resumo = analise.resumo || undefined
      alertas = analise.alertas.length ? analise.alertas : undefined
    } catch (error) {
      console.warn('[Extracao] IA ignorada', error instanceof Error ? error.message : error)
    }
  }

  return { valores, resumo, alertas }
}

export async function extrairCamadas(opts: {
  paginas: PaginaTexto[]
  chaves: string[]
  rotulos?: Record<string, string>
  regras: Array<{ nome: string; tipo: string; parametros: unknown }>
}): Promise<{
  regex: Record<string, string>
  ia: Record<string, string>
  resumo?: string
  alertas?: string[]
  iaStatus: IaExtracaoStatus
}> {
  const { paginas, chaves, rotulos = {}, regras } = opts
  const texto = paginas.map((pagina) => pagina.texto).join('\n')
  const uniqueChaves = [...new Set(chaves.filter(Boolean))]
  const aliases = [...new Set(uniqueChaves.flatMap((chave) => [chave, rotulos[chave]].filter(Boolean)))]
  const bruto = extrairCampos(texto, aliases)
  const regex: Record<string, string> = {}
  for (const chave of uniqueChaves) {
    const found = bruto[chave] || (rotulos[chave] ? bruto[rotulos[chave]] : undefined)
    if (found?.trim()) regex[chave] = found.trim()
  }

  if (!isGroqConfigured() || !uniqueChaves.length || !texto.trim()) {
    return { regex, ia: {}, iaStatus: isGroqConfigured() ? 'nao_aplicada' : 'nao_configurada' }
  }

  try {
    const recorte = recortarTextoRelevante(paginas, [...aliases, ...Object.values(rotulos)])
    const analise = await withTimeout(extrairEAnalisarDocumento(recorte, uniqueChaves, regras, rotulos), 45_000)
    const ia: Record<string, string> = {}
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
      alertas: analise.alertas.length ? analise.alertas : undefined,
      iaStatus: 'sucesso',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.warn('[Extracao] IA ignorada', message)
    const iaStatus: IaExtracaoStatus = /tempo limite|timeout|aborted/i.test(message) ? 'timeout' : 'indisponivel'
    return { regex, ia: {}, iaStatus }
  }
}
