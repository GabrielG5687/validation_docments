import { describe, expect, it } from 'vitest'
import { verificarEvidencia, diagnosticarTexto, recortarTextoRelevante } from './evidenciaService'
import { normalizarCpf, normalizarCnpj, normalizarData, normalizarMoeda, normalizarBooleano } from './normalizadores'
import { falhaSoInconclusiva, resolverCandidatos } from './resolverCandidatos'

const paginas = [
  { numero: 1, texto: 'Nome: Ana Lima\nResponsável: Outra Pessoa' },
  { numero: 2, texto: 'CPF: 529.982.247-25\nValidade: 10/04/2026' },
]

describe('evidencia', () => {
  it('aceita trecho presente e rejeita valor inventado', () => {
    expect(verificarEvidencia(paginas, '529.982.247-25')?.pagina).toBe(2)
    expect(verificarEvidencia(paginas, '111.111.111-11')).toBeNull()
  })

  it('diagnostica pdf sem texto e recorta páginas relevantes', () => {
    expect(diagnosticarTexto([{ numero: 1, texto: '   ' }])).toBe('sem_texto_selecionavel')
    const recorte = recortarTextoRelevante(
      [{ numero: 1, texto: 'a'.repeat(8000) }, { numero: 2, texto: `CNPJ no rodapé ${'b'.repeat(8000)}` }],
      ['CNPJ'],
      500,
    )
    expect(recorte).toContain('Página 2')
    expect(recorte.length).toBeLessThanOrEqual(500)
  })
})

describe('normalizadores', () => {
  it('canoniza documentos válidos e rejeita ambiguidade', () => {
    expect(normalizarCpf('52998224725').ok && normalizarCpf('52998224725')).toMatchObject({ ok: true, canonico: '529.982.247-25' })
    expect(normalizarCpf('111.111.111-11').ok).toBe(false)
    expect(normalizarCnpj('04.252.011/0001-10').ok).toBe(true)
    expect(normalizarData('10/04/2026')).toMatchObject({ ok: true, canonico: '10/04/2026' })
    expect(normalizarData('2026-04-10').ok).toBe(false)
    expect(normalizarMoeda('R$ 1.250,50')).toMatchObject({ ok: true, canonico: '1250.50' })
    expect(normalizarBooleano('não')).toMatchObject({ ok: true, canonico: 'false' })
    expect(normalizarBooleano('talvez').ok).toBe(false)
  })
})

describe('resolverCandidatos', () => {
  it('não confirma valor da IA ausente no texto e registra conflito', () => {
    const resolvido = resolverCandidatos({
      chaves: ['nome', 'cpf'],
      paginas,
      regex: { nome: 'Ana Lima' },
      ia: { nome: 'Outra Pessoa', cpf: '000.000.000-00' },
      diagnostico: 'ok',
      iaStatus: 'sucesso',
    })
    expect(resolvido.confirmados.nome).toBeUndefined()
    expect(resolvido.confirmados.cpf).toBeUndefined()
    expect(resolvido.extracao.campos.find((campo) => campo.chave === 'nome')?.status).toBe('conflito')
    expect(resolvido.extracao.campos.find((campo) => campo.chave === 'cpf')?.status).toBe('sem_evidencia')
  })

  it('confirma regex com evidência e retém reprovação automática quando só há campo inconclusivo', () => {
    const resolvido = resolverCandidatos({
      chaves: ['cpf'],
      paginas,
      regex: { cpf: '529.982.247-25' },
      ia: {},
      diagnostico: 'ok',
      iaStatus: 'nao_configurada',
    })
    expect(resolvido.confirmados.cpf).toBe('529.982.247-25')
    expect(falhaSoInconclusiva(
      [{ obrigatoria: true, parametros: { campo: 'nome' } }],
      [{ status: 'reprovado' }],
      ['nome'],
    )).toBe(true)
    expect(falhaSoInconclusiva(
      [{ obrigatoria: true, parametros: { campo: 'cpf' } }],
      [{ status: 'reprovado' }],
      [],
    )).toBe(false)
  })
})
