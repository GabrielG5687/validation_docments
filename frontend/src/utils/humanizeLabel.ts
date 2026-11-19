const LABELS: Record<string, string> = {
  nome: 'Nome',
  nomeAluno: 'Nome do aluno',
  nome_aluno: 'Nome do aluno',
  matricula: 'Matrícula',
  curso: 'Curso',
  disciplina: 'Disciplina',
  turma: 'Turma',
  periodo: 'Período',
  semestre: 'Semestre',
  professor: 'Professor',
  cargaHoraria: 'Carga horária',
  carga_horaria: 'Carga horária',
  preRequisitos: 'Pré-requisitos',
  pre_requisitos: 'Pré-requisitos',
  ementa: 'Ementa',
  objetivos: 'Objetivos',
  data: 'Data',
  dataEmissao: 'Data de emissão',
  data_emissao: 'Data de emissão',
  dataValidade: 'Data de validade',
  instituicao: 'Instituição',
  codigo: 'Código',
  tipoDocumento: 'Tipo de documento',
}

/** Converte chave técnica (camelCase/snake) em rótulo legível. */
export function humanizeLabel(key: string): string {
  if (LABELS[key]) return LABELS[key]
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}
