export type Normalizacao =
  | { ok: true; bruto: string; canonico: string }
  | { ok: false; bruto: string; motivo: 'ausente' | 'invalido' | 'ambiguo' }

function limpar(valor: string | null | undefined): string {
  return (valor ?? '').trim()
}

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function normalizarCpf(valor: string | null | undefined): Normalizacao {
  const bruto = limpar(valor)
  if (!bruto) return { ok: false, bruto, motivo: 'ausente' }
  const digitos = apenasDigitos(bruto)
  if (digitos.length !== 11 || /^(\d)\1+$/.test(digitos)) return { ok: false, bruto, motivo: 'invalido' }
  const nums = digitos.split('').map(Number)
  const dv = (fator: number) => {
    const soma = nums.slice(0, fator - 1).reduce((acc, n, i) => acc + n * (fator - i), 0)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  if (dv(10) !== nums[9] || dv(11) !== nums[10]) return { ok: false, bruto, motivo: 'invalido' }
  return { ok: true, bruto, canonico: `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}` }
}

export function normalizarCnpj(valor: string | null | undefined): Normalizacao {
  const bruto = limpar(valor)
  if (!bruto) return { ok: false, bruto, motivo: 'ausente' }
  const digitos = apenasDigitos(bruto)
  if (digitos.length !== 14 || /^(\d)\1+$/.test(digitos)) return { ok: false, bruto, motivo: 'invalido' }
  const nums = digitos.split('').map(Number)
  const calc = (tamanho: number) => {
    const pesos = tamanho === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = nums.slice(0, tamanho).reduce((acc, n, i) => acc + n * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  if (calc(12) !== nums[12] || calc(13) !== nums[13]) return { ok: false, bruto, motivo: 'invalido' }
  return {
    ok: true,
    bruto,
    canonico: `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`,
  }
}

/** Formato brasileiro explícito: dd/mm/aaaa. Não reinterpreta mês e dia. */
export function normalizarData(valor: string | null | undefined): Normalizacao {
  const bruto = limpar(valor)
  if (!bruto) return { ok: false, bruto, motivo: 'ausente' }
  const match = bruto.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (!match) return { ok: false, bruto, motivo: 'ambiguo' }
  const dia = Number(match[1])
  const mes = Number(match[2])
  const ano = Number(match[3])
  const data = new Date(ano, mes - 1, dia, 12)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return { ok: false, bruto, motivo: 'invalido' }
  }
  const dd = String(dia).padStart(2, '0')
  const mm = String(mes).padStart(2, '0')
  return { ok: true, bruto, canonico: `${dd}/${mm}/${ano}` }
}

export function normalizarMoeda(valor: string | null | undefined): Normalizacao {
  const bruto = limpar(valor)
  if (!bruto) return { ok: false, bruto, motivo: 'ausente' }
  const semSimbolo = bruto.replace(/r\$\s*/i, '').trim()
  if (!/^[\d.]+,\d{2}$/.test(semSimbolo) && !/^\d+$/.test(semSimbolo.replace(/\./g, ''))) {
    if (!/^\d{1,3}(\.\d{3})*,\d{2}$/.test(semSimbolo) && !/^\d+,\d{2}$/.test(semSimbolo)) {
      return { ok: false, bruto, motivo: 'ambiguo' }
    }
  }
  const canonico = semSimbolo.includes(',')
    ? semSimbolo.replace(/\./g, '').replace(',', '.')
    : semSimbolo.replace(/\./g, '')
  if (!/^\d+(\.\d{2})?$/.test(canonico)) return { ok: false, bruto, motivo: 'invalido' }
  const [inteiro, centavos = '00'] = canonico.split('.')
  return { ok: true, bruto, canonico: `${inteiro}.${centavos.padEnd(2, '0').slice(0, 2)}` }
}

export function normalizarBooleano(valor: string | null | undefined): Normalizacao {
  const bruto = limpar(valor)
  if (!bruto) return { ok: false, bruto, motivo: 'ausente' }
  const texto = bruto.toLowerCase()
  if (['sim', 'true', 'verdadeiro', 'yes'].includes(texto)) return { ok: true, bruto, canonico: 'true' }
  if (['nao', 'não', 'false', 'falso', 'no'].includes(texto)) return { ok: true, bruto, canonico: 'false' }
  return { ok: false, bruto, motivo: 'ambiguo' }
}

export function normalizarPorChave(chave: string, valor: string | null | undefined): Normalizacao {
  const id = chave.toLowerCase()
  if (id.includes('cnpj')) return normalizarCnpj(valor)
  if (id.includes('cpf')) return normalizarCpf(valor)
  if (id.includes('data') || id.includes('emissao') || id.includes('validade') || id.includes('vencimento')) return normalizarData(valor)
  if (id.includes('valor') || id.includes('moeda') || id.includes('preco')) return normalizarMoeda(valor)
  const bruto = limpar(valor)
  if (!bruto) return { ok: false, bruto, motivo: 'ausente' }
  return { ok: true, bruto, canonico: bruto }
}
