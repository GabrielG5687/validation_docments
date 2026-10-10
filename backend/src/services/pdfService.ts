import pdfParse from 'pdf-parse'

/**
 * Extracts the full text content from a PDF buffer using `pdf-parse`.
 *
 * Requirements: 6.1
 *
 * @param buffer - The raw PDF file contents.
 * @returns A promise resolving to the extracted plain text.
 * @throws If `pdf-parse` cannot process the buffer (caller should catch and
 *         set document status to `erro_extracao`).
 */
export async function extrairTexto(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  return data.text
}

export type PaginaExtraida = { numero: number; texto: string }

export async function extrairPaginas(buffer: Buffer): Promise<PaginaExtraida[]> {
  const paginas: PaginaExtraida[] = []
  let numero = 0
  await pdfParse(buffer, {
    pagerender: async (pageData: { getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }) => {
      numero += 1
      const content = await pageData.getTextContent()
      const texto = content.items.map((item) => item.str || '').join(' ').replace(/[ \t]+/g, ' ').trim()
      paginas.push({ numero, texto })
      return texto
    },
  })
  return paginas
}

/**
 * Extracts field values from a plain-text document by looking for simple
 * key-value patterns such as `fieldName: value` or `fieldName value` on the
 * same line.
 *
 * Rules applied for each field name in `campos`:
 *  1. Try pattern `fieldName:  <value>` (colon separator, optional spaces).
 *  2. Try pattern `fieldName  <value>`  (whitespace separator).
 *  3. Capture everything until end-of-line as the value and trim it.
 *
 * Requirements: 6.2, 6.3
 *
 * @param texto  - Plain text extracted from the PDF.
 * @param campos - List of field names to search for.
 * @returns A record mapping each found field name to its extracted value.
 *          Fields not found in the text are omitted from the result.
 *          Returns `{}` for empty text or when no fields are found.
 */
export function extrairCampos(
  texto: string,
  campos: string[]
): Record<string, string> {
  if (!texto || campos.length === 0) {
    return {}
  }

  const resultado: Record<string, string> = {}

  for (const campo of campos) {
    // Escape any regex special chars in the field name
    const escapedCampo = campo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Pattern 1: "fieldName: value" (colon separator)
    const colonPattern = new RegExp(
      `^${escapedCampo}\\s*:\\s*(.+)$`,
      'im'
    )

    // Pattern 2: "fieldName value" (space separator)
    const spacePattern = new RegExp(
      `^${escapedCampo}\\s+(.+)$`,
      'im'
    )

    const match =
      colonPattern.exec(texto) ?? spacePattern.exec(texto)

    if (match) {
      const value = match[1].trim()
      if (value) {
        resultado[campo] = value
      }
    }
  }

  return resultado
}
