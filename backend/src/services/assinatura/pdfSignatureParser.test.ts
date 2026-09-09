import { describe, expect, it } from 'vitest'
import { byteRangeCoversFile, findPdfSignatures, trimDer } from './pdfSignatureParser'

describe('pdfSignatureParser', () => {
  it('corta o padding do /Contents DER', () => {
    const inner = Buffer.from('3003010100', 'hex')
    const padded = Buffer.concat([inner, Buffer.alloc(32, 0)])
    expect(trimDer(padded).equals(inner)).toBe(true)
  })

  it('não trata texto ou carimbo visual como assinatura', () => {
    const pdf = Buffer.from('%PDF-1.7\nDocumento assinado eletronicamente pelo gov.br\n%%EOF\n', 'latin1')
    expect(findPdfSignatures(pdf)).toEqual([])
  })

  it('encontra /ByteRange com /Contents PKCS#7', () => {
    const hex = Buffer.from('3003010100', 'hex').toString('hex')
    const after = '\n%%EOF'
    const hole = `<${hex}>`
    const makeLeft = (b: number, c: number, d: number) => `%PDF-1.7\n/ByteRange [0 ${b} ${c} ${d}] /Contents `
    let b = 40
    let c = 60
    let d = after.length
    for (let i = 0; i < 5; i++) {
      b = Buffer.byteLength(makeLeft(b, c, d), 'latin1')
      c = b + Buffer.byteLength(hole, 'latin1')
      d = Buffer.byteLength(after, 'latin1')
    }
    const pdf = Buffer.from(`${makeLeft(b, c, d)}${hole}${after}`, 'latin1')
    const found = findPdfSignatures(pdf)
    expect(found).toHaveLength(1)
    expect(found[0].contentsDer[0]).toBe(0x30)
  })

  it('marca arquivo íntegro quando ByteRange cobre o PDF', () => {
    const pdf = Buffer.alloc(100, 1)
    expect(byteRangeCoversFile(pdf, [0, 40, 50, 50])).toBe(true)
    expect(byteRangeCoversFile(pdf, [0, 40, 50, 40])).toBe(false)
  })
})
