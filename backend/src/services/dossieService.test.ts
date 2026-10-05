import { describe, expect, it } from 'vitest'
import { resumirConformidadeItens, statusDossie, type ItemStatus } from './dossieService'

describe('dossieService', () => {
  it('statusDossie exige todos os obrigatórios atendidos', () => {
    expect(statusDossie([])).toBe('pendente')
    expect(statusDossie([{ status: 'atendido', obrigatorio: false }])).toBe('pendente')
    expect(statusDossie([
      { status: 'atendido', obrigatorio: true },
      { status: 'faltando', obrigatorio: false },
    ])).toBe('em_compliance')
    expect(statusDossie([
      { status: 'atendido', obrigatorio: true },
      { status: 'vencido', obrigatorio: true },
    ])).toBe('pendente')
  })

  it('resumirConformidadeItens ignora opcionais e trata vencido', () => {
    const mapa = new Map<string, ItemStatus>([
      ['t1', { status: 'atendido' }],
      ['t2', { status: 'vencido' }],
      ['t3', { status: 'faltando' }],
      ['t4', { status: 'atendido' }],
    ])
    const resumo = resumirConformidadeItens(
      [
        { templateId: 't1', obrigatorio: true },
        { templateId: 't2', obrigatorio: true },
        { templateId: 't3', obrigatorio: true },
        { templateId: 't4', obrigatorio: false },
      ],
      mapa,
    )
    expect(resumo).toEqual({
      totalItens: 3,
      atendidos: 1,
      faltando: 1,
      vencidos: 1,
      percentual: 33,
    })
  })
})
