export const MAX_FILE_SIZE = 20 * 1024 * 1024
export function validarPDF(file: File) { return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') }
export function validarTamanho(file: File) { return file.size <= MAX_FILE_SIZE }
