export interface PdfSignatureBlock {
  byteRange: [number, number, number, number]
  contentsDer: Buffer
  subFilter?: string
}

function readAsn1Length(buf: Buffer, offset: number): { length: number; headerSize: number } {
  if (offset >= buf.length) throw new Error('DER truncado')
  const first = buf[offset]
  if (first < 0x80) return { length: first, headerSize: 1 }
  const size = first & 0x7f
  if (size === 0 || size > 4 || offset + size >= buf.length) throw new Error('Comprimento DER inválido')
  let length = 0
  for (let i = 1; i <= size; i++) length = (length << 8) | buf[offset + i]
  return { length, headerSize: 1 + size }
}

export function trimDer(padded: Buffer): Buffer {
  if (padded.length < 2 || padded[0] !== 0x30) {
    const start = padded.indexOf(0x30)
    if (start < 0) throw new Error('Conteúdo da assinatura não é DER PKCS#7')
    return trimDer(padded.subarray(start))
  }
  const { length, headerSize } = readAsn1Length(padded, 1)
  const total = 1 + headerSize + length
  if (total > padded.length) throw new Error('Bloco PKCS#7 maior que o campo /Contents')
  return padded.subarray(0, total)
}

function extractHexFromHole(hole: Buffer): string {
  const text = hole.toString('latin1')
  const start = text.indexOf('<')
  const end = text.lastIndexOf('>')
  if (start < 0 || end <= start) throw new Error('Campo /Contents da assinatura não encontrado')
  const hex = text.slice(start + 1, end).replace(/[^0-9A-Fa-f]/g, '')
  if (hex.length < 8) throw new Error('Campo /Contents vazio')
  return hex.length % 2 === 0 ? hex : `0${hex}`
}

function nearbySubFilter(pdfLatin1: string, byteRangeIndex: number): string | undefined {
  const window = pdfLatin1.slice(Math.max(0, byteRangeIndex - 800), byteRangeIndex + 1200)
  const match = window.match(/\/SubFilter\s*\/([A-Za-z0-9.]+)/)
  return match?.[1]
}

/**
 * Locates CMS/PKCS#7 signature dictionaries via /ByteRange — the cryptographic
 * container — never visual stamps, QR codes or the words "gov.br".
 */
export function findPdfSignatures(pdf: Buffer): PdfSignatureBlock[] {
  const latin1 = pdf.toString('latin1')
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g
  const found: PdfSignatureBlock[] = []
  const seen = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = re.exec(latin1))) {
    const byteRange: [number, number, number, number] = [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
    ]
    const key = byteRange.join(',')
    if (seen.has(key)) continue
    seen.add(key)

    const holeStart = byteRange[0] + byteRange[1]
    const holeEnd = byteRange[2]
    if (holeStart < 0 || holeEnd > pdf.length || holeEnd <= holeStart) continue
    if (byteRange[2] + byteRange[3] > pdf.length) continue

    try {
      const hex = extractHexFromHole(pdf.subarray(holeStart, holeEnd))
      const contentsDer = trimDer(Buffer.from(hex, 'hex'))
      found.push({
        byteRange,
        contentsDer,
        subFilter: nearbySubFilter(latin1, match.index),
      })
    } catch {
      // Ignore ByteRange entries that are not a CMS signature hole.
    }
  }

  return found
}

export function signedBytes(pdf: Buffer, byteRange: [number, number, number, number]): Buffer {
  const [a, b, c, d] = byteRange
  return Buffer.concat([pdf.subarray(a, a + b), pdf.subarray(c, c + d)])
}

/**
 * True when the signature covers the entire file except the /Contents hole.
 * Extra bytes after the range usually mean an incremental update after signing.
 */
export function byteRangeCoversFile(pdf: Buffer, byteRange: [number, number, number, number]): boolean {
  const [a, b, c, d] = byteRange
  return a === 0 && c + d === pdf.length && a + b < c
}
