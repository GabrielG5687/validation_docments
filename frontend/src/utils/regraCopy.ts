import type { CampoTemplate, RegraValidacao, TipoRegra } from '../types'
import { formatCurrency, presetFromRegex } from './formatPresets'

export const REGRA_LABELS: Record<TipoRegra, { title: string; hint: string }> = {
  campo_obrigatorio: { title: 'Campo obrigatório', hint: 'O documento precisa ter este dado preenchido.' },
  formato: { title: 'Formato', hint: 'Garante CPF, CNPJ, e-mail ou outro padrão.' },
  intervalo: { title: 'Intervalo', hint: 'Define o valor mínimo e máximo aceito.' },
  calculo: { title: 'Cálculo', hint: 'Confere se um total bate com a soma ou multiplicação.' },
}

function campoNome(identificador: string, campos: CampoTemplate[]) {
  return campos.find((campo) => campo.identificador === identificador)?.nome || identificador
}

export function describeRegra(regra: Pick<RegraValidacao, 'tipo' | 'parametros' | 'nome'>, campos: CampoTemplate[] = []): string {
  const params = regra.parametros || {}
  const campo = campoNome(String(params.campo ?? ''), campos)
  if (regra.tipo === 'campo_obrigatorio') return `O campo “${campo || 'selecionado'}” precisa estar preenchido.`
  if (regra.tipo === 'formato') {
    const preset = presetFromRegex(String(params.regex ?? ''))
    return preset
      ? `“${campo}” deve estar no formato de ${preset.label} (${preset.hint}).`
      : `“${campo}” deve seguir o formato configurado.`
  }
  if (regra.tipo === 'intervalo') {
    const min = Number(params.min)
    const max = Number(params.max)
    const tipo = campos.find((item) => item.identificador === params.campo)?.tipo
    const fmt = (n: number) => (tipo === 'moeda' && Number.isFinite(n) ? formatCurrency(n) : String(n))
    return `O valor de “${campo}” deve estar entre ${fmt(min)} e ${fmt(max)}.`
  }
  const resultado = campoNome(String(params.campo_resultado ?? ''), campos)
  return `“${resultado || 'resultado'}” deve ser igual a ${String(params.expressao ?? 'a fórmula')} (± ${params.tolerancia ?? 0}).`
}

export function describeValor(valor?: string) {
  if (valor === undefined || valor === null || valor === '') return 'sem valor'
  return valor
}
