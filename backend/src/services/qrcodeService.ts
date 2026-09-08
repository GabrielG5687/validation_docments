import QRCode from 'qrcode'

/**
 * Generates a QR Code PNG image (300 × 300 px) that encodes the public
 * verification URL for the given document code.
 *
 * URL format: `{baseUrl}/verificar/{codigo}`
 *
 * Requirements: 9.3, 9.4
 *
 * @param codigo  - The unique verification code (e.g. `"X7F9-32AB"`).
 * @param baseUrl - The application base URL (e.g. `"https://app.example.com"`).
 * @returns A promise resolving to a `Buffer` containing the PNG image data.
 */
export async function gerarQRCode(
  codigo: string,
  baseUrl: string
): Promise<Buffer> {
  const url = `${baseUrl}/verificar/${codigo}`
  return QRCode.toBuffer(url, { type: 'png', width: 300, margin: 2 })
}
