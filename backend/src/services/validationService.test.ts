import { describe, expect, it } from 'vitest'
import { aplicarRegra } from './validationService'
import type { FonteCampo } from './validationService'

const regra = (tipo: 'campo_obrigatorio' | 'formato' | 'intervalo' | 'calculo', parametros: Record<string, unknown>) =>
  ({ id: 'r1', tipo, parametros } as never)

const fonte = (status: FonteCampo['status'], temValor = true): FonteCampo => ({ status, temValor })

describe('validationService', () => {
  it('applies required, format and interval rules', () => {
    expect(aplicarRegra(regra('campo_obrigatorio', { campo: 'nome' }), { nome: 'Ana' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('formato', { campo: 'cpf', regex: '^\\d{3}$' }), { cpf: '123' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('intervalo', { campo: 'nota', min: 0, max: 10 }), { nota: '10' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('intervalo', { campo: 'nota', min: 0, max: 10 }), { nota: 'x' }).status).toBe('nao_verificavel')
    expect(aplicarRegra(regra('intervalo', { campo: 'nota', min: 0, max: 10 }), { nota: '11' }).status).toBe('nao_conforme')
  })

  it('aceita data brasileira mesmo quando a regex da IA esquece os dias 10 a 19', () => {
    const quebrada = '^(dd|2[0-9]|3[0-1])/(0[1-9]|1[0-2])/\\d{4}$'
    expect(aplicarRegra(regra('formato', { campo: 'inicio', regex: quebrada }), { inicio: '14/08/2026' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('formato', { campo: 'fim', regex: quebrada }), { fim: '18/12/2026' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('formato', { campo: 'assinatura', regex: '^\\d{2}/\\d{2}/\\d{4}$' }), { assinatura: '23/08/2026' }).status).toBe('aprovado')
  })

  it('rejects invalid regex and evaluates calculations without runtime access', () => {
    expect(aplicarRegra(regra('formato', { campo: 'x', regex: '[' }), { x: 'x' }).status).toBe('nao_verificavel')
    expect(aplicarRegra(regra('calculo', { expressao: 'a + b * 2', campo_resultado: 'resultado', tolerancia: 0.01 }), { a: '2', b: '3', resultado: '8' }).status).toBe('aprovado')
    expect(aplicarRegra(regra('calculo', { expressao: 'process.exit()', campo_resultado: 'resultado', tolerancia: 0 }), { resultado: '0' }).status).toBe('nao_encontrado')
  })

  it('classifica a ausência conforme a origem do campo', () => {
    const obrigatoria = regra('campo_obrigatorio', { campo: 'nome' })
    expect(aplicarRegra(obrigatoria, {}).status).toBe('nao_encontrado')
    expect(aplicarRegra(obrigatoria, {}, { nome: fonte('conflito') }).status).toBe('extracao_conflitante')
    expect(aplicarRegra(obrigatoria, {}, { nome: fonte('ambiguo') }).status).toBe('nao_verificavel')
    expect(aplicarRegra(obrigatoria, {}, { nome: fonte('sem_evidencia', true) }).status).toBe('nao_verificavel')
    expect(aplicarRegra(obrigatoria, {}, { nome: fonte('sem_evidencia', false) }).status).toBe('nao_encontrado')
    expect(aplicarRegra(obrigatoria, { nome: 'Ana' }, { nome: fonte('conflito') }).status).toBe('aprovado')
  })

  it('não aprova regra sem campo configurado', () => {
    expect(aplicarRegra(regra('campo_obrigatorio', {}), { nome: 'Ana' }).status).toBe('nao_verificavel')
  })

  it('marca cálculo como não verificável quando uma referência está inconclusiva', () => {
    const calculo = regra('calculo', { expressao: 'a + b', campo_resultado: 'total' })
    expect(aplicarRegra(calculo, { a: '1' }, { b: fonte('conflito') }).status).toBe('extracao_conflitante')
    expect(aplicarRegra(calculo, { a: '1' }, { b: fonte('sem_evidencia', true) }).status).toBe('nao_verificavel')
  })
})
