export type Perfil = 'usuario' | 'validador' | 'coordenador' | 'admin'
export type StatusTemplate = 'rascunho' | 'ativo' | 'inativo'
export type TipoRegra = 'campo_obrigatorio' | 'formato' | 'intervalo' | 'calculo'
export type StatusDocumento = 'processando' | 'aguardando_validacao' | 'aguardando_revisao' | 'em_revisao' | 'aprovado' | 'reprovado' | 'reprovado_automatico' | 'erro_extracao'
export type TipoCampo = 'texto' | 'numero' | 'data' | 'moeda' | 'documento' | 'texto_longo'
export type StudioStep = 'informacoes' | 'campos' | 'regras' | 'teste' | 'revisao'

export interface Usuario { id: string; nome: string; email: string; perfil: Perfil; status: boolean; criadoEm: string }

export interface CampoTemplate {
  id: string
  nome: string
  identificador: string
  tipo: TipoCampo
  obrigatorio: boolean
  descricao?: string
  valorPadrao?: string
}

export interface SecaoTemplate {
  id: string
  nome: string
  campos: CampoTemplate[]
}

export interface EstruturaTemplate {
  secoes: SecaoTemplate[]
}

export interface Template {
  id: string
  nome: string
  descricao?: string
  categoria?: string
  status: StatusTemplate
  versaoAtual: string
  estrutura?: EstruturaTemplate | null
  criadoEm: string
  atualizadoEm?: string
  regras?: RegraValidacao[]
  _count?: { regras: number; documentos: number; versoes?: number }
}

export interface RegraValidacao {
  id: string
  templateId?: string
  nome: string
  tipo: TipoRegra
  parametros: Record<string, unknown>
  obrigatoria: boolean
  ativo: boolean
  ordem: number
}

export interface TemplateVersao {
  id: string
  versao: string
  publicadoEm: string
  numRegras: number
  numCampos?: number
  snapshot?: {
    nome?: string
    descricao?: string
    categoria?: string
    regras?: Array<Pick<RegraValidacao, 'id' | 'nome' | 'tipo' | 'parametros' | 'obrigatoria' | 'ativo' | 'ordem'>>
    estrutura?: EstruturaTemplate
  }
}

export interface TesteTemplateResultado {
  resultado: 'aprovado' | 'reprovado'
  aprovadas: number
  reprovadas: number
  valores: Record<string, string>
  resumo?: string
  alertas?: string[]
  resultados: Array<{
    regraId: string
    nome: string
    tipo: TipoRegra
    status: 'aprovado' | 'reprovado'
    valorEncontrado?: string
    criterio: string
  }>
}

export interface ResultadoRegra { id: string; validacaoId: string; regraId: string; status: 'aprovado' | 'reprovado'; valorEncontrado?: string; criterio?: string; regra?: Pick<RegraValidacao, 'id' | 'nome' | 'tipo'> }
export interface Validacao { id: string; documentoId: string; validadorId: string; resultado: 'aprovado' | 'reprovado'; observacoes?: string; criadoEm: string; validador?: Pick<Usuario, 'id' | 'nome'>; resultadosRegra?: ResultadoRegra[] }
export interface HistoricoStatus { id: string; documentoId: string; statusAnterior?: string; statusNovo: string; usuarioId?: string; criadoEm: string }
export interface Documento { id: string; usuarioId: string; templateId: string; nomeArquivo: string; hashSha256: string; dadosExtraidos?: Record<string, unknown>; status: StatusDocumento; codigoVerificacao?: string; qrcodeKey?: string; documentoOrigemId?: string; criadoEm: string; usuario?: Pick<Usuario, 'id' | 'nome' | 'email'>; template?: Pick<Template, 'id' | 'nome'>; validacoes?: Validacao[]; historico?: HistoricoStatus[]; presignedUrl?: string; qrcodeUrl?: string }
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

export interface AnaliseIa {
  resumo: string
  alertas: string[]
  regrasSugeridas?: Array<Pick<RegraValidacao, 'nome' | 'tipo' | 'parametros' | 'obrigatoria'>>
}
export interface DashboardData { perfil: Perfil; contadores?: Record<string, number>; ultimosDocumentos?: Documento[]; [key: string]: unknown }
export interface ReportData { periodo: { inicio: string; fim: string }; totais: { enviados: number; aprovados: number; reprovados: number; emProcessamento: number; taxaAprovacao: number; tempoMedioHoras: number }; porTemplate: Array<Record<string, string | number>>; porValidador: Array<Record<string, string | number>> }
