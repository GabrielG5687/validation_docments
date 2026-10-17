import { verificarEvidencia, type PaginaTexto } from './evidenciaService'
import { normalizarPorChave } from './normalizadores'
import { EXTRACAO_VERSAO, type CampoExtraido, type ExtracaoDocumento } from './schema'

export type IaExtracaoStatus = ExtracaoDocumento['ia']

function mesmoValor(a: string, b: string): boolean {
  const normal = (valor: string) => valor.replace(/\s+/g, '').toLocaleLowerCase('pt-BR')
  return normal(a) === normal(b) || a.replace(/\D/g, '') === b.replace(/\D/g, '') && a.replace(/\D/g, '').length >= 8
}

export function resolverCandidatos(input: {
  chaves: string[]
  paginas: PaginaTexto[]
  regex: Record<string, string>
  ia: Record<string, string>
  diagnostico: ExtracaoDocumento['diagnostico']
  iaStatus: IaExtracaoStatus
}): { extracao: ExtracaoDocumento; confirmados: Record<string, string>; inconclusivos: string[] } {
  const campos: CampoExtraido[] = []
  const confirmados: Record<string, string> = {}
  const inconclusivos: string[] = []

  for (const chave of input.chaves) {
    const brutoRegex = input.regex[chave]?.trim() || ''
    const brutoIa = input.ia[chave]?.trim() || ''
    const evidenciaRegex = brutoRegex ? verificarEvidencia(input.paginas, brutoRegex) : null
    const evidenciaIa = brutoIa ? verificarEvidencia(input.paginas, brutoIa) : null

    let origem: CampoExtraido['origem'] = 'regex'
    let bruto = ''
    let evidencia = evidenciaRegex
    let status: CampoExtraido['status'] = 'sem_evidencia'
    let confianca: CampoExtraido['confianca'] = 'baixa'

    if (brutoRegex && brutoIa && !mesmoValor(brutoRegex, brutoIa) && evidenciaRegex && evidenciaIa) {
      status = 'conflito'
      bruto = brutoRegex
      evidencia = evidenciaRegex
      origem = 'regex'
    } else if (evidenciaRegex) {
      status = 'validado'
      bruto = brutoRegex
      evidencia = evidenciaRegex
      origem = 'regex'
      confianca = 'alta'
    } else if (evidenciaIa) {
      status = 'validado'
      bruto = brutoIa
      evidencia = evidenciaIa
      origem = 'ia'
      confianca = 'media'
    } else if (brutoRegex || brutoIa) {
      status = 'sem_evidencia'
      bruto = brutoRegex || brutoIa
      evidencia = null
      origem = brutoRegex ? 'regex' : 'ia'
    } else {
      continue
    }

    const normalizado = normalizarPorChave(chave, bruto)
    if (status === 'validado' && !normalizado.ok && normalizado.motivo !== 'ausente') {
      status = normalizado.motivo === 'ambiguo' ? 'ambiguo' : 'sem_evidencia'
      confianca = 'baixa'
    }

    const valorNormalizado = normalizado.ok ? normalizado.canonico : null
    campos.push({
      chave,
      valorBruto: bruto || null,
      valorNormalizado,
      evidencia,
      origem,
      confianca,
      status,
    })

    if (status === 'validado' && valorNormalizado) confirmados[chave] = valorNormalizado
    else inconclusivos.push(chave)
  }

  return {
    extracao: {
      versao: EXTRACAO_VERSAO,
      diagnostico: input.diagnostico,
      ia: input.iaStatus,
      campos,
    },
    confirmados,
    inconclusivos,
  }
}
