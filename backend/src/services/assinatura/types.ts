export type StatusAssinaturaGov =
  | 'VALIDA'
  | 'INVALIDA'
  | 'DOCUMENTO_ALTERADO'
  | 'CERTIFICADO_INVALIDO'
  | 'CERTIFICADO_EXPIRADO'
  | 'CERTIFICADO_REVOGADO'
  | 'SEM_ASSINATURA'
  | 'NAO_ICP_BRASIL'
  | 'NAO_FOI_POSSIVEL_VALIDAR'

export interface CertificadoAssinatura {
  valido: boolean
  icpBrasil: boolean
  emissor: string
  sujeito: string
  inicioValidade: string
  fimValidade: string
  revogado: boolean
  revogacaoVerificada: boolean
  serial: string
}

export interface AssinaturaPdfResultado {
  valida: boolean
  icpBrasil: boolean
  assinaturaCriptograficaOk: boolean
  documentoIntegro: boolean
  assinante: string
  dataAssinatura?: string
  subFilter?: string
  certificado: CertificadoAssinatura
  motivo?: string
}

export interface ValidacaoAssinaturaGov {
  valido: boolean
  documentoIntegro: boolean
  icpBrasil: boolean
  assinaturas: AssinaturaPdfResultado[]
  status: StatusAssinaturaGov
  mensagem: string
  validadoEm: string
  observacoes: string[]
}
