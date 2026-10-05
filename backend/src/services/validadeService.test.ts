import { describe, expect, it } from 'vitest'
import { calcularStatus, diasEntre, parseData, derivarValidade } from './validadeService'

describe('validadeService', () => {
  it('parseData aceita ISO e formato BR', () => {
    expect(parseData('2026-10-03')?.getFullYear()).toBe(2026)
    const br = parseData('03/10/2026')
    expect(br?.getDate()).toBe(3)
    expect(br?.getMonth()).toBe(9)
    expect(parseData('')).toBeNull()
    expect(parseData(null)).toBeNull()
  })

  it('diasEntre calcula diferença em dias civis', () => {
    const hoje = new Date(2026, 9, 3, 18)
    const alvo = new Date(2026, 9, 10, 1)
    expect(diasEntre(hoje, alvo)).toBe(7)
    expect(diasEntre(hoje, new Date(2026, 9, 1))).toBe(-2)
  })

  it('calcularStatus cobre valido, proximo e vencido', () => {
    const hoje = new Date(2026, 9, 3, 12)
    expect(calcularStatus(null, hoje).statusValidade).toBeNull()
    expect(calcularStatus(new Date(2026, 10, 20), hoje, 30).statusValidade).toBe('valido')
    expect(calcularStatus(new Date(2026, 9, 20), hoje, 30).statusValidade).toBe('proximo_vencimento')
    expect(calcularStatus(new Date(2026, 9, 1), hoje, 30)).toMatchObject({
      statusValidade: 'vencido',
      diasParaVencer: -2,
    })
  })

  it('derivarValidade usa data explícita ou validadeDias a partir da emissão', () => {
    const comValidade = derivarValidade({ data_validade: '31/12/2026', data_emissao: '01/01/2026' })
    expect(comValidade.dataValidade?.getFullYear()).toBe(2026)
    expect(comValidade.dataValidade?.getMonth()).toBe(11)

    const porPrazo = derivarValidade({ data_emissao: '01/01/2026' }, 30)
    expect(porPrazo.dataValidade?.getDate()).toBe(31)
    expect(porPrazo.dataValidade?.getMonth()).toBe(0)

    const semData = derivarValidade({ nome: 'x' }, 30)
    expect(semData.dataValidade).toBeNull()
  })
})
