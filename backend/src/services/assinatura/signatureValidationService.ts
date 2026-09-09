/**
 * Validação de assinatura digital em PDF (PAdES / PKCS#7), com foco em gov.br / ICP-Brasil.
 *
 * O que este serviço valida DIRETAMENTE no arquivo:
 * - Existência de dicionário de assinatura com /ByteRange e /Contents (CMS)
 * - Integridade: hash dos bytes cobertos pelo ByteRange = messageDigest
 * - Criptografia: assinatura RSA/ECDSA do PKCS#7 sobre os atributos autenticados
 * - Certificado X.509 do assinante (CN, emissor, validade)
 * - Se o ByteRange cobre o arquivo inteiro (exceto o buraco /Contents)
 * - Indícios ICP-Brasil: OID 2.16.76.1 e/ou "ICP-Brasil" no DN
 * - Encadeamento dos certificados embarcados no CMS
 *
 * O que DEPENDE de material/serviço externo:
 * - Âncora da AC Raiz ICP-Brasil: coloque PEMs em backend/certs/icp-brasil/
 * - Revogação (CRL): busca HTTP nos pontos de distribuição do certificado; se a rede falhar, revogacaoVerificada=false
 * - OCSP não é consultado nesta versão
 *
 * NÃO é prova de autenticidade: texto "assinado", imagem, QR Code, carimbo visual ou a palavra "gov.br".
 */
import {
  byteRangeCoversFile,
  findPdfSignatures,
  signedBytes,
} from './pdfSignatureParser'
import { verifyDetachedCms } from './cmsVerify'
import {
  certificateValidAt,
  chainLooksIcpBrasil,
  issuerDn,
  subjectCn,
  subjectDn,
  verifyCertificateChain,
} from './icpBrasil'
import { checkRevocation } from './revocation'
import type { AssinaturaPdfResultado, StatusAssinaturaGov, ValidacaoAssinaturaGov } from './types'

function mensagemStatus(status: StatusAssinaturaGov): string {
  switch (status) {
    case 'VALIDA':
      return 'Assinatura digital válida e documento íntegro (ICP-Brasil / gov.br).'
    case 'INVALIDA':
      return 'A assinatura digital existe, mas a verificação criptográfica falhou.'
    case 'DOCUMENTO_ALTERADO':
      return 'A assinatura é criptograficamente válida, mas o PDF foi alterado depois de assinado (bytes fora do ByteRange).'
    case 'CERTIFICADO_INVALIDO':
      return 'O certificado da assinatura não pôde ser validado na cadeia.'
    case 'CERTIFICADO_EXPIRADO':
      return 'O certificado estava fora do período de validade na data da assinatura.'
    case 'CERTIFICADO_REVOGADO':
      return 'O certificado consta como revogado na CRL.'
    case 'SEM_ASSINATURA':
      return 'Nenhuma assinatura digital criptográfica foi encontrada no PDF.'
    case 'NAO_ICP_BRASIL':
      return 'Há assinatura digital no PDF, mas o certificado não foi identificado como ICP-Brasil / gov.br.'
    default:
      return 'A assinatura foi detectada, mas não foi possível concluir a validação.'
  }
}

function aggregate(assinaturas: AssinaturaPdfResultado[]): Pick<ValidacaoAssinaturaGov, 'status' | 'valido' | 'documentoIntegro' | 'icpBrasil'> {
  if (!assinaturas.length) {
    return { status: 'SEM_ASSINATURA', valido: false, documentoIntegro: true, icpBrasil: false }
  }
  const icpBrasil = assinaturas.some((item) => item.icpBrasil)
  const documentoIntegro = assinaturas.every((item) => item.documentoIntegro)

  if (assinaturas.every((item) => !item.assinaturaCriptograficaOk && item.motivo?.includes('Não foi possível'))) {
    return { status: 'NAO_FOI_POSSIVEL_VALIDAR', valido: false, documentoIntegro, icpBrasil }
  }
  if (assinaturas.some((item) => !item.assinaturaCriptograficaOk)) {
    return { status: 'INVALIDA', valido: false, documentoIntegro: false, icpBrasil }
  }
  if (assinaturas.some((item) => item.certificado.revogado)) {
    return { status: 'CERTIFICADO_REVOGADO', valido: false, documentoIntegro, icpBrasil }
  }
  if (assinaturas.some((item) => item.assinaturaCriptograficaOk && !item.documentoIntegro)) {
    return { status: 'DOCUMENTO_ALTERADO', valido: false, documentoIntegro: false, icpBrasil }
  }
  if (assinaturas.some((item) => item.motivo?.toLowerCase().includes('expir'))) {
    return { status: 'CERTIFICADO_EXPIRADO', valido: false, documentoIntegro, icpBrasil }
  }
  if (assinaturas.some((item) => !item.icpBrasil)) {
    return { status: 'NAO_ICP_BRASIL', valido: false, documentoIntegro, icpBrasil: false }
  }
  if (assinaturas.some((item) => !item.certificado.valido)) {
    return { status: 'CERTIFICADO_INVALIDO', valido: false, documentoIntegro, icpBrasil }
  }
  if (assinaturas.every((item) => item.valida && item.documentoIntegro && item.icpBrasil)) {
    return { status: 'VALIDA', valido: true, documentoIntegro: true, icpBrasil: true }
  }
  return { status: 'CERTIFICADO_INVALIDO', valido: false, documentoIntegro, icpBrasil }
}

export function validacaoAssinaturaIndisponivel(motivo: string): ValidacaoAssinaturaGov {
  return {
    valido: false,
    documentoIntegro: false,
    icpBrasil: false,
    assinaturas: [],
    status: 'NAO_FOI_POSSIVEL_VALIDAR',
    mensagem: 'A assinatura digital não pôde ser validada neste momento.',
    validadoEm: new Date().toISOString(),
    observacoes: [motivo],
  }
}

export async function validarAssinaturasPdf(pdf: Buffer): Promise<ValidacaoAssinaturaGov> {
  const observacoes: string[] = [
    'Validação baseada no PKCS#7/CMS do PDF (/ByteRange e /Contents), não em carimbos visuais, QR Code ou texto.',
    'Revogação depende de CRL acessível na rede. OCSP não é consultado.',
    'Para âncora da AC Raiz, adicione certificados em backend/certs/icp-brasil/.',
  ]

  const blocos = findPdfSignatures(pdf)
  if (!blocos.length) {
    return {
      valido: false,
      documentoIntegro: true,
      icpBrasil: false,
      assinaturas: [],
      status: 'SEM_ASSINATURA',
      mensagem: mensagemStatus('SEM_ASSINATURA'),
      validadoEm: new Date().toISOString(),
      observacoes,
    }
  }

  const assinaturas: AssinaturaPdfResultado[] = []
  for (const bloco of blocos) {
    const integro = byteRangeCoversFile(pdf, bloco.byteRange)
    try {
      const cms = verifyDetachedCms(bloco.contentsDer, signedBytes(pdf, bloco.byteRange))
      const at = cms.signingTime || new Date()
      const validade = certificateValidAt(cms.signer, at)
      const icp = chainLooksIcpBrasil(cms.certificates)
      const cadeia = verifyCertificateChain(cms.certificates, at)
      const revogacao = await checkRevocation(cms.signer)

      let motivo: string | undefined
      if (!cms.ok) motivo = cms.reason
      else if (!integro) motivo = 'Há bytes no PDF fora do intervalo assinado (possível alteração após a assinatura)'
      else if (!validade.ok) motivo = validade.expired
        ? 'Certificado expirado na data da assinatura'
        : 'Certificado ainda não era válido na data da assinatura'
      else if (revogacao.revogado) motivo = 'Certificado revogado'
      else if (!cadeia.ok) motivo = cadeia.reason
      else if (!icp) motivo = 'Certificado não identificado como ICP-Brasil / gov.br'

      const valida = Boolean(cms.ok && integro && validade.ok && cadeia.ok && icp && !revogacao.revogado)

      assinaturas.push({
        valida,
        icpBrasil: icp,
        assinaturaCriptograficaOk: cms.ok,
        documentoIntegro: integro && cms.ok,
        assinante: subjectCn(cms.signer),
        dataAssinatura: cms.signingTime?.toISOString(),
        subFilter: bloco.subFilter,
        certificado: {
          valido: validade.ok && cadeia.ok && !revogacao.revogado,
          icpBrasil: icp,
          emissor: issuerDn(cms.signer),
          sujeito: subjectDn(cms.signer),
          inicioValidade: cms.signer.validity.notBefore.toISOString(),
          fimValidade: cms.signer.validity.notAfter.toISOString(),
          revogado: revogacao.revogado,
          revogacaoVerificada: revogacao.verificado,
          serial: cms.signer.serialNumber,
        },
        motivo,
      })
    } catch (error) {
      assinaturas.push({
        valida: false,
        icpBrasil: false,
        assinaturaCriptograficaOk: false,
        documentoIntegro: integro,
        assinante: 'Desconhecido',
        subFilter: bloco.subFilter,
        certificado: {
          valido: false,
          icpBrasil: false,
          emissor: '—',
          sujeito: '—',
          inicioValidade: '',
          fimValidade: '',
          revogado: false,
          revogacaoVerificada: false,
          serial: '',
        },
        motivo: error instanceof Error ? `Não foi possível validar esta assinatura: ${error.message}` : 'Não foi possível validar esta assinatura',
      })
    }
  }

  const resumo = aggregate(assinaturas)
  if (assinaturas.some((item) => !item.certificado.revogacaoVerificada)) {
    observacoes.push('Pelo menos um certificado não teve a CRL verificada (URL ausente ou indisponível).')
  }

  return {
    ...resumo,
    assinaturas,
    mensagem: mensagemStatus(resumo.status),
    validadoEm: new Date().toISOString(),
    observacoes,
  }
}

export { mensagemStatus }
