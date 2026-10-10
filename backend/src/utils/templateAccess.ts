import { PapelEmpresa, Prisma, RegraValidacao, Template } from '@prisma/client'
import prisma from '../config/prisma'

/**
 * Isolamento de templates por empresa.
 *
 * Um template só existe no contexto da empresa que o criou. Templates legados
 * (sem `empresaId`) ficam órfãos e, por isso, invisíveis: só aparecem depois de
 * reatribuídos. Todo acesso fecha por padrão — sem empresa ativa, nada é lido.
 */

/** Id sentinela: garante resultado vazio quando não há empresa no contexto. */
const IMPOSSIVEL = '__sem_empresa_ativa__'

/** Filtro de listagem. Sem empresa ativa, retorna uma condição que nunca casa. */
export function whereTemplatesVisiveis(empresaId?: string): Prisma.TemplateWhereInput {
  if (empresaId) return { empresaId }
  return { id: IMPOSSIVEL }
}

/** Filtro de acesso a um template específico, já combinando com outros campos. */
export function whereTemplateDaEmpresa(
  id: string,
  empresaId?: string,
): Prisma.TemplateWhereInput {
  if (!empresaId) return { id: IMPOSSIVEL }
  return { id, empresaId }
}

/**
 * Busca um template garantindo que pertence à empresa ativa.
 * Retorna `null` (→ 404) quando o template é de outra empresa ou não existe.
 */
export async function buscarTemplateDaEmpresa<T extends object = Record<string, never>>(
  id: string,
  empresaId: string | undefined,
  include?: Prisma.TemplateInclude,
): Promise<(Template & T) | null> {
  if (!empresaId) return null

  const template = await prisma.template.findFirst({
    where: { id, empresaId },
    include: include as Prisma.TemplateInclude,
  })

  return template as (Template & T) | null
}

/**
 * Busca uma regra garantindo que o template dono pertence à empresa ativa.
 * Retorna `null` (→ 404) quando a regra é de outra empresa ou não existe.
 */
export async function regraDaEmpresa(
  id: string,
  empresaId: string | undefined,
): Promise<RegraValidacao | null> {
  if (!empresaId) return null

  return prisma.regraValidacao.findFirst({
    where: { id, template: { empresaId } },
  })
}

/** Admin global ou proprietário (OWNER) da empresa ativa. */
export function podeGerenciarTemplates(perfil: string, papel?: PapelEmpresa): boolean {
  return perfil === 'admin' || papel === 'OWNER'
}

export default {
  whereTemplatesVisiveis,
  whereTemplateDaEmpresa,
  buscarTemplateDaEmpresa,
  regraDaEmpresa,
  podeGerenciarTemplates,
}
