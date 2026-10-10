import { z } from 'zod'

export const EXTRACAO_VERSAO = 1

export const evidenciaSchema = z.object({
  texto: z.string(),
  pagina: z.number().int().positive(),
  inicio: z.number().int().nonnegative().optional(),
  fim: z.number().int().nonnegative().optional(),
  verificada: z.boolean(),
  metodo: z.enum(['texto_pdf', 'ocr']),
})

export const campoExtraidoSchema = z.object({
  chave: z.string().min(1),
  valorBruto: z.string().nullable(),
  valorNormalizado: z.string().nullable(),
  evidencia: evidenciaSchema.nullable(),
  origem: z.enum(['regex', 'ia', 'humano']),
  confianca: z.enum(['alta', 'media', 'baixa']),
  status: z.enum(['validado', 'ambiguo', 'sem_evidencia', 'conflito', 'corrigido_humano']),
})

export const extracaoDocumentoSchema = z.object({
  versao: z.literal(EXTRACAO_VERSAO),
  diagnostico: z.enum(['ok', 'sem_texto_selecionavel', 'texto_insuficiente']),
  ia: z.enum(['nao_configurada', 'sucesso', 'sucesso_parcial', 'schema_invalido', 'timeout', 'indisponivel', 'nao_aplicada']),
  campos: z.array(campoExtraidoSchema),
})

export type EvidenciaCampo = z.infer<typeof evidenciaSchema>
export type CampoExtraido = z.infer<typeof campoExtraidoSchema>
export type ExtracaoDocumento = z.infer<typeof extracaoDocumentoSchema>

export function parseExtracaoDocumento(raw: unknown): ExtracaoDocumento | null {
  const parsed = extracaoDocumentoSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
