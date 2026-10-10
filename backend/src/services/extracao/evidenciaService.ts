import { apenasDigitos } from './normalizadores'
import type { EvidenciaCampo } from './schema'

export type PaginaTexto = { numero: number; texto: string }

function compactar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

function indice(haystack: string, needle: string): number {
  if (!needle) return -1
  return haystack.toLocaleLowerCase('pt-BR').indexOf(needle.toLocaleLowerCase('pt-BR'))
}

export function verificarEvidencia(paginas: PaginaTexto[], valor: string | null | undefined): EvidenciaCampo | null {
  const alvo = compactar(valor ?? '')
  if (!alvo) return null
  const digitosAlvo = apenasDigitos(alvo)
  for (const pagina of paginas) {
    const texto = compactar(pagina.texto)
    let inicio = indice(texto, alvo)
    if (inicio < 0 && digitosAlvo.length >= 8) {
      const digitosPagina = apenasDigitos(texto)
      const posicao = digitosPagina.indexOf(digitosAlvo)
      if (posicao >= 0) inicio = 0
    }
    if (inicio < 0) continue
    const fim = inicio + alvo.length
    const margem = 48
    const trecho = texto.slice(Math.max(0, inicio - margem), Math.min(texto.length, fim + margem))
    return {
      texto: trecho,
      pagina: pagina.numero,
      inicio: inicio >= 0 ? inicio : undefined,
      fim: inicio >= 0 ? fim : undefined,
      verificada: true,
      metodo: 'texto_pdf',
    }
  }
  return null
}

export function recortarTextoRelevante(paginas: PaginaTexto[], termos: string[], maxChars = 12_000): string {
  const uteis = termos.map((termo) => termo.trim()).filter((termo) => termo.length >= 3)
  const blocos = paginas
    .filter((pagina) => pagina.texto.trim())
    .map((pagina) => `Página ${pagina.numero}\n${compactar(pagina.texto)}`)
  const completo = blocos.join('\n\n')
  if (completo.length <= maxChars) return completo

  const escolhidos = paginas.filter((pagina) => {
    const texto = pagina.texto.toLocaleLowerCase('pt-BR')
    return uteis.some((termo) => texto.includes(termo.toLocaleLowerCase('pt-BR')))
  })
  const base = (escolhidos.length ? escolhidos : paginas.slice(0, 2).concat(paginas.slice(-1)))
    .map((pagina) => `Página ${pagina.numero}\n${compactar(pagina.texto)}`)
    .join('\n\n')
  if (base.length <= maxChars) return base

  const janelas: string[] = []
  for (const pagina of paginas) {
    const texto = compactar(pagina.texto)
    const baixo = texto.toLocaleLowerCase('pt-BR')
    for (const termo of uteis) {
      const em = baixo.indexOf(termo.toLocaleLowerCase('pt-BR'))
      if (em < 0) continue
      janelas.push(`Página ${pagina.numero}\n${texto.slice(Math.max(0, em - 180), em + termo.length + 220)}`)
    }
  }
  const recorte = janelas.join('\n\n')
  return (recorte || base).slice(0, maxChars)
}

export function diagnosticarTexto(paginas: PaginaTexto[]): 'ok' | 'sem_texto_selecionavel' | 'texto_insuficiente' {
  const total = paginas.reduce((acc, pagina) => acc + compactar(pagina.texto).length, 0)
  if (total === 0) return 'sem_texto_selecionavel'
  if (total < 40) return 'texto_insuficiente'
  return 'ok'
}
