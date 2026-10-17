import { afterEach, describe, expect, it, vi } from 'vitest'
import { encode } from '@toon-format/toon'
import {
  analisarTemplateComIa,
  extrairEAnalisarDocumento,
  gerarParecerIa,
  gerarTemplateComIa,
} from './groqService'

function mockGroqResponse(response: unknown, formato: 'toon' | 'json' = 'toon'): string[] {
  const requestBodies: string[] = []
  vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBodies.push(String(init?.body))
    const content = formato === 'json' ? JSON.stringify(response) : encode(response)
    return new Response(JSON.stringify({
      choices: [{ message: { content } }],
    }), { status: 200 })
  })
  return requestBodies
}

function lerPrompt(requestBodies: string[]): string {
  const body = JSON.parse(requestBodies[0]) as { messages: Array<{ content: string }> }
  return body.messages.map((message) => message.content).join('\n')
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
    const prompt = lerPrompt(requestBodies)

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
    const prompt = lerPrompt(requestBodies)

    expect(prompt).toContain(descricao)
    expect(prompt).toContain('Use a descrição do template como contexto')
    expect(prompt).toContain('mesmo quando o documento não atender')
  })

  it('includes the template description when analyzing rules against a PDF', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    const requestBodies = mockGroqResponse({ resumo: 'Análise concluída.', alertas: [], regras: [] })
    const descricao = 'Validar o diário da turma e sua consolidação.'

    await analisarTemplateComIa([], 'Status da Turma: CONSOLIDADA', descricao)
    const prompt = lerPrompt(requestBodies)

    expect(prompt).toContain(descricao)
    expect(prompt).toContain('documento de exemplo pode não cumprir todos os requisitos')
  })

  it('asks for a TOON response and does not send the json response_format', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    const requestBodies = mockGroqResponse({ resumo: 'ok', alertas: [], regras: [] })

    await analisarTemplateComIa([], undefined, undefined)

    const body = JSON.parse(requestBodies[0]) as { response_format?: unknown }
    expect(body.response_format).toBeUndefined()
    expect(lerPrompt(requestBodies)).toContain('Responda APENAS em TOON')
  })

  it('serializes fields, labels and rules as TOON blocks in the prompt', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    const requestBodies = mockGroqResponse({
      campos: { codigo_verificacao: '6065c033f2' },
      resumo: 'Código identificado.',
      alertas: [],
    })

    await extrairEAnalisarDocumento(
      'Código de Verificação: 6065c033f2',
      ['codigo_verificacao'],
      [{ nome: 'Código obrigatório', tipo: 'campo_obrigatorio', parametros: { campo: 'Código de Verificação' } }],
      { codigo_verificacao: 'Código de Verificação' },
      'Diário consolidado com código de verificação.',
    )
    const prompt = lerPrompt(requestBodies)

    expect(prompt).toContain('Campos (chaves) em TOON:')
    expect(prompt).toContain('Rótulos em TOON:')
    expect(prompt).toContain('Regras em TOON:')
    expect(prompt).toContain('```toon')
    expect(prompt).toContain('codigo_verificacao')
  })

  it('accepts a JSON response as fallback when the model does not follow TOON', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    mockGroqResponse({
      nome: 'Diário de turma',
      descricao: 'Descrição gerada',
      regras: [{
        nome: 'Código de verificação obrigatório',
        tipo: 'campo_obrigatorio',
        obrigatoria: true,
        parametros: { campo: 'Código de Verificação' },
      }],
    }, 'json')

    const template = await gerarTemplateComIa('Código de Verificação: 6065c033f2', 'Diário', 'Descrição gerada')

    expect(template.nome).toBe('Diário')
    expect(template.regras).toHaveLength(1)
    expect(template.regras[0].parametros.campo).toBe('Código de Verificação')
  })

  it('gera o parecer da IA apenas com dados comprovados e sem o texto bruto', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    const requestBodies = mockGroqResponse({
      analise: 'CPF confere e os campos obrigatórios estão presentes.',
      pendencias: ['Assinatura do orientador sem evidência verificável'],
      conclusao: 'Depende de revisão humana.',
    })

    const parecer = await gerarParecerIa({
      documentoNome: 'diario.pdf',
      templateNome: 'Diário',
      resultados: [
        { nome: 'CPF', tipo: 'formato', status: 'aprovado', valorEncontrado: '529.982.247-25', criterio: 'regex', obrigatoria: true },
        { nome: 'Assinatura', tipo: 'campo_obrigatorio', status: 'nao_verificavel', criterio: 'sem evidência', obrigatoria: true },
      ],
      pendencias: [{ chave: 'assinatura', rotulo: 'Assinatura', status: 'sem_evidencia' }],
    })
    const prompt = lerPrompt(requestBodies)

    expect(parecer?.pendencias).toHaveLength(1)
    expect(prompt).toContain('Resultados comprovados das regras em TOON')
    expect(prompt).toContain('529.982.247-25')
    expect(prompt).toContain('Não afirme que o documento foi reprovado')
  })

  it('não chama a IA para o parecer quando não há resultados', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key')
    mockGroqResponse({ analise: '', pendencias: [], conclusao: '' })

    const parecer = await gerarParecerIa({ documentoNome: 'x.pdf', resultados: [], pendencias: [] })

    expect(parecer).toBeNull()
  })
})
