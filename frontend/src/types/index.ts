export type Perfil = 'usuario' | 'validador' | 'coordenador' | 'admin'
export type StatusTemplate = 'rascunho' | 'ativo' | 'inativo'
export type TipoRegra = 'campo_obrigatorio' | 'formato' | 'intervalo' | 'calculo'
export type StatusDocumento = 'processando' | 'aguardando_validacao' | 'aguardando_revisao' | 'em_revisao' | 'aprovado' | 'reprovado' | 'reprovado_automatico' | 'erro_extracao'
export type TipoCampo = 'texto' | 'numero' | 'data' | 'moeda' | 'documento' | 'texto_longo'
export type StudioStep = 'informacoes' | 'campos' | 'regras' | 'teste' | 'revisao'
export type ValidadeStatus = 'valido' | 'proximo_vencimento' | 'vencido' | 'sem_validade'
export type TipoEntidade = 'empresa' | 'pessoa'
export type DossieStatus = 'em_compliance' | 'pendente' | 'aprovado'
export type StatusItemChecklist = 'atendido' | 'faltando' | 'vencido'

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
  validadeDias?: number | null
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

export type StatusRegra = 'aprovado' | 'nao_conforme' | 'nao_encontrado' | 'extracao_conflitante' | 'nao_verificavel'

export interface TesteTemplateResultado {
  resultado: 'aprovado' | 'reprovado' | 'inconclusivo'
  aprovadas: number
  reprovadas: number
  valores: Record<string, string>
  resumo?: string
  resultados: Array<{
    regraId: string
    nome: string
    tipo: TipoRegra
    status: StatusRegra
    valorEncontrado?: string
    criterio: string
  }>
}

export interface ResultadoRegra { id: string; validacaoId: string; regraId: string; status: StatusRegra; valorEncontrado?: string; criterio?: string; explicacaoIa?: string; regra?: Pick<RegraValidacao, 'id' | 'nome' | 'tipo'> }
export interface ParecerIa { analise: string; pendencias: string[]; conclusao: string }
export interface Validacao { id: string; documentoId: string; validadorId: string; resultado: 'aprovado' | 'reprovado' | 'inconclusivo'; observacoes?: string; parecerIa?: string | null; criadoEm: string; validador?: Pick<Usuario, 'id' | 'nome'>; resultadosRegra?: ResultadoRegra[] }
export interface HistoricoStatus { id: string; documentoId: string; statusAnterior?: string; statusNovo: string; usuarioId?: string; criadoEm: string }
export interface Documento { id: string; usuarioId: string; templateId: string; nomeArquivo: string; hashSha256: string; dadosExtraidos?: Record<string, unknown>; status: StatusDocumento; codigoVerificacao?: string; qrcodeKey?: string; documentoOrigemId?: string; entidadeId?: string; dossieItemId?: string; dataEmissao?: string | null; dataValidade?: string | null; statusValidade?: ValidadeStatus | null; diasParaVencer?: number | null; renovacaoNecessaria?: boolean | null; criadoEm: string; usuario?: Pick<Usuario, 'id' | 'nome' | 'email'>; template?: Pick<Template, 'id' | 'nome'>; entidade?: Pick<Entidade, 'id' | 'nome'>; validacoes?: Validacao[]; historico?: HistoricoStatus[]; presignedUrl?: string; qrcodeUrl?: string }
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
export interface ResumoExtracao { resumo?: string }
export interface DashboardData { perfil: Perfil; contadores?: Record<string, number>; ultimosDocumentos?: Documento[]; [key: string]: unknown }
export interface ReportData { periodo: { inicio: string; fim: string }; totais: { enviados: number; aprovados: number; reprovados: number; emProcessamento: number; taxaAprovacao: number; tempoMedioHoras: number }; porTemplate: Array<Record<string, string | number>>; porValidador: Array<Record<string, string | number>> }

export interface Entidade {
  id: string
  tipo: TipoEntidade
  nome: string
  documentoIdentificador?: string
  cnpjOuCpf?: string
  responsavelId?: string
  criadoEm: string
  atualizadoEm: string
  responsavel?: Pick<Usuario, 'id' | 'nome' | 'email'>
  dossies?: Dossie[]
  conformidade?: { totalItens: number; atendidos: number; percentual: number }
  _count?: { dossies: number; documentos: number }
}

export interface DossieItem {
  id: string
  dossieId?: string
  templateId: string
  templateNome?: string
  obrigatorio: boolean
  ordem: number
  status?: StatusItemChecklist
  documento?: { id: string; nomeArquivo: string; dataValidade?: string | null; statusValidade?: ValidadeStatus | null; criadoEm: string; diasParaVencer?: number | null } | null
}

export interface Dossie {
  id: string
  entidadeId: string
  nome: string
  descricao?: string
  status: DossieStatus
  criadoEm: string
  atualizadoEm?: string
  entidade?: Pick<Entidade, 'id' | 'nome' | 'tipo'>
  itens?: DossieItem[]
  _count?: { itens: number }
}

export interface ConformidadeEntidade {
  entidadeId: string
  dossies: Array<{ id: string; nome: string; _count: { itens: number } }>
  totalItens: number
  obrigatorios: number
  atendidos: number
  faltando: number
  vencidos: number
  percentual: number
  itens: Array<DossieItem & { dossieId: string; dossieNome?: string }>
}

export interface Notificacao {
  id: string
  destinatarioId: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  documentoId?: string
  dossieId?: string
  entidadeId?: string
  criadoEm: string
}

export type ValidadeFiltro = 'vencido' | 'proximos' | 'todos' | ''

export type PapelEmpresa = 'OWNER' | 'ADMIN' | 'MEMBER'
export type StatusConviteEmpresa = 'pendente' | 'aceito' | 'expirado' | 'revogado'
export type PermissaoEmpresa =
  | 'members.view'
  | 'members.invite'
  | 'members.edit'
  | 'members.remove'
  | 'company.settings'

export interface EmpresaResumo {
  id: string
  nome: string
  papel: PapelEmpresa
  permissoes: PermissaoEmpresa[]
  criadoEm: string
}

export interface MembroEmpresa {
  id: string
  papel: PapelEmpresa
  criadoEm: string
  usuario: Pick<Usuario, 'id' | 'nome' | 'email' | 'status' | 'criadoEm'>
}

export interface ConviteEmpresa {
  id: string
  email: string
  papel: PapelEmpresa
  status: StatusConviteEmpresa
  expiraEm: string
  aceitoEm?: string | null
  criadoEm: string
  link?: string
  expiraEmHoras?: number
}

export interface ConvitePreview {
  email: string
  papel: PapelEmpresa
  papelRotulo: string
  status: StatusConviteEmpresa
  expiraEm: string
  empresa: { id: string; nome: string }
  contaExiste: boolean
}
