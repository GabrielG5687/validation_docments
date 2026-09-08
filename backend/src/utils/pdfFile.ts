export const MAX_PDF_SIZE = 20 * 1024 * 1024

export function isPdfBuffer(file: Express.Multer.File): boolean {
  return file.mimetype === 'application/pdf' && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'
}

export function pdfFromRequest(
  file: Express.Multer.File | undefined
): { ok: true; file: Express.Multer.File } | { ok: false; status: number; error: string } {
  if (!file) return { ok: false, status: 422, error: 'Arquivo PDF é obrigatório' }
  if (file.size > MAX_PDF_SIZE) return { ok: false, status: 413, error: 'O arquivo não pode exceder 20 MB' }
  if (!isPdfBuffer(file)) return { ok: false, status: 415, error: 'O arquivo enviado não é um PDF válido' }
  return { ok: true, file }
}
