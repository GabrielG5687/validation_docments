import { describe, expect, it } from 'vitest'
import { validarRegexGerado } from './regexGerado'

describe('validarRegexGerado', () => {
  it('aceita uma expressão ancorada e remove as barras', () => {
    expect(validarRegexGerado('/^\\d{2}$/')).toBe('^\\d{2}$')
  })

  it('recusa expressão vazia, longa ou com repetição perigosa', () => {
    expect(() => validarRegexGerado('   ')).toThrow(/inválida/)
    expect(() => validarRegexGerado('a'.repeat(181))).toThrow(/longa/)
    expect(() => validarRegexGerado('(a+)+')).toThrow(/insegura/)
    expect(() => validarRegexGerado('[')).toThrow(/não é uma regex/)
  })
})