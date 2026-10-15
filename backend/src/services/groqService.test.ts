import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  analisarTemplateComIa,
  extrairEAnalisarDocumento,
  gerarTemplateComIa,
} from './groqService'

function mockGroqResponse(response: unknown): string[] {
  const requestBodies: string[] = []
  vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBodies.push(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(response) } }],
    }), { status: 200 })
  })
  return requestBodies
}

describe('groqService template context', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('uses the user description when generating a template from a sample PDF', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    const requestBodies = mockGroqResponse({
      nome: 'Diário de turma',
      descricao: 'Descrição gerada',
      regras: [{
        nome: 'Código de verificação obrigatório',
        tipo: 'campo_obrigatorio',
        obrigatoria: true,
        parametros: { campo: 'Código de Verificação' },
      }],
    })
    const descricao = 'Validar diário consolidado, com identificação da turma e código de verificação.'

    const template = await gerarTemplateComIa('Código de Verificação: 6065c033f2', 'Diário', descricao)
    const prompt = JSON.parse(requestBodies[0]).messages.map((message: { content: string }) => message.content).join('\n')

    expect(template.descricao).toBe(descricao)
    expect(prompt).toContain(descricao)
    expect(prompt).toContain('Código de Verificação: 6065c033f2')
  })

  it('uses the template description to interpret extracted fields without treating it as evidence', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    const requestBodies = mockGroqResponse({
      campos: { codigo_verificacao: '6065c033f2' },
      resumo: 'Código identificado.',
      alertas: [],
    })
    const descricao = 'Diário consolidado deve conter código de verificação.'

    await extrairEAnalisarDocumento(
      'Código de Verificação: 6065c033f2',
      ['codigo_verificacao'],
      [],
      { codigo_verificacao: 'Código de Verificação' },
      descricao,
    )
    const prompt = JSON.parse(requestBodies[0]).messages.map((message: { content: string }) => message.content).join('\n')

    expect(prompt).toContain(descricao)
    expect(prompt).toContain('Use a descrição do template como contexto')
    expect(prompt).toContain('mesmo quando o documento não atender')
  })

  it('includes the template description when analyzing rules against a PDF', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    const requestBodies = mockGroqResponse({ resumo: 'Análise concluída.', alertas: [], regras: [] })
    const descricao = 'Validar o diário da turma e sua consolidação.'

    await analisarTemplateComIa([], 'Status da Turma: CONSOLIDADA', descricao)
    const prompt = JSON.parse(requestBodies[0]).messages.map((message: { content: string }) => message.content).join('\n')

    expect(prompt).toContain(descricao)
    expect(prompt).toContain('documento de exemplo pode não cumprir todos os requisitos')
  })
})
