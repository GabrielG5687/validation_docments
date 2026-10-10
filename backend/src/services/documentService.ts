import { Prisma, StatusDocumento } from '@prisma/client'
import prisma from '../config/prisma'
import { downloadFile } from './minioService'
import { BUCKET_DOCUMENTOS } from './minioService'
import { extrairPaginas } from './pdfService'
import { aplicarRegra } from './validationService'
import { extrairCamadas } from './extracaoCamposService'
import { diagnosticarTexto } from './extracao/evidenciaService'
import { falhaSoInconclusiva, resolverCandidatos } from './extracao/resolverCandidatos'
import { parseEstrutura, flattenCampos } from '../utils/estrutura'
import { validacaoAssinaturaIndisponivel, validarAssinaturasPdf } from './assinatura/signatureValidationService'
import { calcularValidadeDocumento } from './validadeService'

async function changeStatus(documentoId: string, status: StatusDocumento, usuarioId?: string) {
  const current = await prisma.documento.findUnique({ where: { id: documentoId }, select: { status: true } })
  if (!current || current.status === status) return
  await prisma.$transaction([
    prisma.documento.update({ where: { id: documentoId }, data: { status } }),
    prisma.historicoStatus.create({
      data: { documentoId, statusAnterior: current.status, statusNovo: status, usuarioId },
    }),
  ])
}

async function systemValidatorId(): Promise<string> {
  const email = 'system-validation@local.invalid'
  const user = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      nome: 'Validação automática',
      email,
      senhaHash: 'invalid',
      perfil: 'admin',
    },
    select: { id: true },
  })
  return user.id
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo limite de processamento excedido')), milliseconds)
    promise.then((value) => { clearTimeout(timer); resolve(value) }, (error) => { clearTimeout(timer); reject(error) })
  })
}

export async function processarDocumento(documentoId: string): Promise<void> {
  const documento = await prisma.documento.findUnique({
    where: { id: documentoId },
    include: { template: { include: { regras: { where: { ativo: true }, orderBy: { ordem: 'asc' } } } } },
  })
  if (!documento || documento.status !== 'processando') return

  try {
    const buffer = await downloadFile(BUCKET_DOCUMENTOS, documento.minioKey)
    const paginas = await withTimeout(extrairPaginas(buffer), 60_000)
    const diagnostico = diagnosticarTexto(paginas)
    if (diagnostico === 'sem_texto_selecionavel') {
      await prisma.documento.update({
        where: { id: documentoId },
        data: {
          status: 'erro_extracao',
          dadosExtraidos: {
            erroExtracao: 'PDF sem texto selecionável. A extração não inventou campos.',
            _extracao: { versao: 1, diagnostico, ia: 'nao_aplicada', campos: [] },
          },
        },
      })
      await prisma.historicoStatus.create({
        data: { documentoId, statusAnterior: 'processando', statusNovo: 'erro_extracao' },
      }).catch(() => undefined)
      return
    }
    const estrutura = parseEstrutura(documento.template.estrutura)
    const rotulos: Record<string, string> = {}
    const campos = new Set<string>()
    for (const campo of flattenCampos(estrutura)) {
      campos.add(campo.identificador)
      if (campo.nome) rotulos[campo.identificador] = campo.nome
    }
    for (const regra of documento.template.regras) {
      const params = regra.parametros as Record<string, unknown>
      if (typeof params.campo === 'string') campos.add(params.campo)
      if (typeof params.campo_resultado === 'string') campos.add(params.campo_resultado)
    }
    const extraido = await extrairCamadas({
      paginas,
      chaves: [...campos],
      rotulos,
      regras: documento.template.regras.map((regra) => ({
        nome: regra.nome,
        tipo: regra.tipo,
        parametros: regra.parametros,
      })),
    })
    const resolvido = resolverCandidatos({
      chaves: [...campos],
      paginas,
      regex: extraido.regex,
      ia: extraido.ia,
      diagnostico,
      iaStatus: extraido.iaStatus,
    })
    const dados: Record<string, unknown> = { ...resolvido.confirmados, _extracao: resolvido.extracao }
    let observacaoIa = extraido.resumo || ''
    if (extraido.resumo || extraido.alertas?.length) {
      dados._analiseIa = { resumo: extraido.resumo || '', alertas: extraido.alertas || [] }
    }
    try {
      dados._assinaturaGov = await withTimeout(validarAssinaturasPdf(buffer), 25_000)
    } catch (error) {
      dados._assinaturaGov = validacaoAssinaturaIndisponivel(
        error instanceof Error ? error.message : 'Falha na validação criptográfica da assinatura'
      )
    }

    const camposParaRegras: Record<string, string> = {}
    for (const [key, value] of Object.entries(dados)) {
      if (key.startsWith('_')) continue
      if (typeof value === 'string') camposParaRegras[key] = value
    }
    const assinatura = dados._assinaturaGov as { status?: string; assinaturas?: Array<{ valida?: boolean; assinante?: string }> } | undefined
    if (assinatura?.status === 'VALIDA') {
      const assinante = assinatura.assinaturas?.find((item) => item.valida && item.assinante)?.assinante
      if (assinante) {
        for (const regra of documento.template.regras) {
          const params = (regra.parametros && typeof regra.parametros === 'object' ? regra.parametros : {}) as Record<string, unknown>
          const campo = typeof params.campo === 'string' ? params.campo : ''
          const mencionaAssinatura = `${campo} ${regra.nome}`.toLowerCase().includes('assinatura')
          const pareceData = `${campo} ${regra.nome}`.toLowerCase().includes('data')
          if (regra.tipo !== 'campo_obrigatorio' || !campo || !mencionaAssinatura || pareceData || camposParaRegras[campo]?.trim()) continue
          camposParaRegras[campo] = assinante
          dados[campo] = assinante
        }
      }
    }

    const validade = calcularValidadeDocumento(dados, documento.template.validadeDias)

    await changeStatus(documentoId, 'aguardando_validacao')
    const resultados = documento.template.regras.map((regra) => aplicarRegra(regra, camposParaRegras))
    const falhaObrigatoria = documento.template.regras.some((regra, i) => regra.obrigatoria && resultados[i].status === 'reprovado')
    const soInconclusivo = falhaSoInconclusiva(documento.template.regras, resultados, resolvido.inconclusivos)
    const resultado = falhaObrigatoria && !soInconclusivo ? 'reprovado' : 'aprovado'
    const novoStatus = falhaObrigatoria && !soInconclusivo ? 'reprovado_automatico' : 'aguardando_revisao'
    const validatorId = await systemValidatorId()
    const observacoes = [
      falhaObrigatoria && !soInconclusivo ? 'Uma ou mais regras obrigatórias não foram atendidas.' : null,
      soInconclusivo ? 'Há campos sem evidência verificável ou em conflito. A aprovação automática foi retida.' : null,
      observacaoIa || null,
    ].filter(Boolean).join(' ')

    await prisma.$transaction(async (tx) => {
      await tx.documento.update({
        where: { id: documentoId },
        data: {
          dadosExtraidos: dados as Prisma.InputJsonValue,
          status: novoStatus,
          dataEmissao: validade.dataEmissao,
          dataValidade: validade.dataValidade,
          statusValidade: validade.statusValidade,
          diasParaVencer: validade.diasParaVencer,
          renovacaoNecessaria: validade.statusValidade === 'vencido',
        },
      })
      await tx.validacao.create({
        data: {
          documentoId,
          validadorId: validatorId,
          resultado,
          observacoes: observacoes || null,
          resultadosRegra: {
            create: resultados.map((item) => ({
              regraId: item.regraId,
              status: item.status,
              valorEncontrado: item.valorEncontrado,
              criterio: item.criterio,
            })),
          },
        },
      })
      await tx.historicoStatus.create({
        data: { documentoId, statusAnterior: 'aguardando_validacao', statusNovo: novoStatus },
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida na extração'
    await prisma.documento.update({
      where: { id: documentoId },
      data: { status: 'erro_extracao', dadosExtraidos: { erroExtracao: message } },
    }).catch(() => undefined)
    await prisma.historicoStatus.create({
      data: { documentoId, statusAnterior: 'processando', statusNovo: 'erro_extracao' },
    }).catch(() => undefined)
    console.error('[DocumentService]', JSON.stringify({ documentoId, message, stack: error instanceof Error ? error.stack : undefined }))
  }
}

export { changeStatus }
export default { processarDocumento }
