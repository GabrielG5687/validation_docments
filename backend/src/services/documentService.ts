import { Prisma, StatusDocumento } from '@prisma/client'
import prisma from '../config/prisma'
import { downloadFile } from './minioService'
import { BUCKET_DOCUMENTOS } from './minioService'
import { extrairTexto } from './pdfService'
import { aplicarRegra } from './validationService'
import { extrairValoresDeDocumento } from './extracaoCamposService'
import { parseEstrutura, flattenCampos } from '../utils/estrutura'

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
    const texto = await withTimeout(extrairTexto(buffer), 60_000)
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
    const extraido = await extrairValoresDeDocumento({
      texto,
      chaves: [...campos],
      rotulos,
      regras: documento.template.regras.map((regra) => ({
        nome: regra.nome,
        tipo: regra.tipo,
        parametros: regra.parametros,
      })),
    })
    const dados: Record<string, unknown> = { ...extraido.valores }
    let observacaoIa = extraido.resumo || ''
    if (extraido.resumo || extraido.alertas?.length) {
      dados._analiseIa = { resumo: extraido.resumo || '', alertas: extraido.alertas || [] }
    }

    const camposParaRegras: Record<string, string> = {}
    for (const [key, value] of Object.entries(dados)) {
      if (key.startsWith('_')) continue
      if (typeof value === 'string') camposParaRegras[key] = value
    }

    await changeStatus(documentoId, 'aguardando_validacao')
    const resultados = documento.template.regras.map((regra) => aplicarRegra(regra, camposParaRegras))
    const falhaObrigatoria = documento.template.regras.some((regra, i) => regra.obrigatoria && resultados[i].status === 'reprovado')
    const resultado = falhaObrigatoria ? 'reprovado' : 'aprovado'
    const novoStatus = falhaObrigatoria ? 'reprovado_automatico' : 'aguardando_revisao'
    const validatorId = await systemValidatorId()
    const observacoes = [
      falhaObrigatoria ? 'Uma ou mais regras obrigatórias não foram atendidas.' : null,
      observacaoIa || null,
    ].filter(Boolean).join(' ')

    await prisma.$transaction(async (tx) => {
      await tx.documento.update({
        where: { id: documentoId },
        data: { dadosExtraidos: dados as Prisma.InputJsonValue, status: novoStatus },
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
