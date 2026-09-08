export interface FormatPreset {
  id: string
  label: string
  hint: string
  regex: string
}

export const FORMAT_PRESETS: FormatPreset[] = [
  { id: 'cpf', label: 'CPF', hint: '000.000.000-00', regex: '^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$' },
  { id: 'cnpj', label: 'CNPJ', hint: '00.000.000/0000-00', regex: '^\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}$' },
  { id: 'email', label: 'E-mail', hint: 'nome@empresa.com', regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
  { id: 'data', label: 'Data', hint: 'dd/mm/aaaa', regex: '^\\d{2}/\\d{2}/\\d{4}$' },
  { id: 'telefone', label: 'Telefone', hint: '(00) 00000-0000', regex: '^\\(?\\d{2}\\)?\\s?\\d{4,5}-?\\d{4}$' },
  { id: 'moeda', label: 'Valor em reais', hint: '1000.50', regex: '^(R\\$\\s?)?\\d{1,3}(\\.\\d{3})*(,\\d{2})?$|^\\d+([.,]\\d{1,2})?$' },
]

export function presetFromRegex(regex?: string) {
  if (!regex) return undefined
  return FORMAT_PRESETS.find((item) => item.regex === regex)
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
