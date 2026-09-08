import { describe, expect, it } from 'vitest'
import { aplicarRegra } from './validationService'

const regra = (tipo: 'campo_obrigatorio' | 'formato' | 'intervalo' | 'calculo', parametros: Record<string, unknown>) =>
  ({ id: 'r1', tipo, parametros } as never)

describe('validationService', () => {
  it('applies required, format and interval rules', () => {
    expect(aplicarRegra(regra('campo_obrigatorio', { campo: 'nome' }), { nome: 'Ana' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('formato', { campo: 'cpf', regex: '^\\d{3}$' }), { cpf: '123' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('intervalo', { campo: 'nota', min: 0, max: 10 }), { nota: '10' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('intervalo', { campo: 'nota', min: 0, max: 10 }), { nota: 'x' }).status).toBe('reprovado')
  })

  it('rejects invalid regex and evaluates calculations without runtime access', () => {
    expect(aplicarRegra(regra('formato', { campo: 'x', regex: '[' }), { x: 'x' }).status).toBe('reprovado')
    expect(aplicarRegra(regra('calculo', { expressao: 'a + b * 2', campo_resultado: 'resultado', tolerancia: 0.01 }), { a: '2', b: '3', resultado: '8' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('calculo', { expressao: 'process.exit()', campo_resultado: 'resultado', tolerancia: 0 }), { resultado: '0' }).status).toBe('reprovado')
  })
})
