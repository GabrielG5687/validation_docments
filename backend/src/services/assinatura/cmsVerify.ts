import crypto from 'crypto'
import forge from 'node-forge'

const OIDS: Record<string, string> = {
  '1.2.840.113549.1.9.4': 'messageDigest',
  '1.2.840.113549.1.9.3': 'contentType',
  '1.2.840.113549.1.9.5': 'signingTime',
  '1.2.840.113549.1.1.1': 'rsaEncryption',
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.113549.2.5': 'md5',
  '1.3.14.3.2.26': 'sha1',
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
}

function oidOf(node: forge.asn1.Asn1 | undefined): string {
  if (!node) return ''
  try {
    return forge.asn1.derToOid(node.value as string)
  } catch {
    return ''
  }
}

function attrValueBytes(attr: forge.asn1.Asn1): Buffer | undefined {
  const children = Array.isArray(attr.value) ? attr.value as forge.asn1.Asn1[] : []
  const set = children.find((item) => item.type === forge.asn1.Type.SET)
  const inner = set && Array.isArray(set.value) ? (set.value as forge.asn1.Asn1[])[0] : undefined
  if (!inner) return undefined
  if (typeof inner.value === 'string') return Buffer.from(inner.value, 'binary')
  return undefined
}

function signingTimeFromAttrs(attrs: forge.asn1.Asn1[]): Date | undefined {
  for (const attr of attrs) {
    const children = Array.isArray(attr.value) ? attr.value as forge.asn1.Asn1[] : []
    if (oidOf(children[0]) !== '1.2.840.113549.1.9.5') continue
    const raw = attrValueBytes(attr)
    if (!raw) continue
    const text = raw.toString('ascii').replace(/\0/g, '').trim()
    const parsed = new Date(text.length === 13 || text.length === 15
      ? // UTCTime YYMMDDHHMMSSZ
        `20${text.slice(0, 2)}-${text.slice(2, 4)}-${text.slice(4, 6)}T${text.slice(6, 8)}:${text.slice(8, 10)}:${text.slice(10, 12)}Z`
      : text)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return undefined
}

function digestName(oid: string): string | undefined {
  const name = OIDS[oid]
  if (name === 'sha1' || name === 'sha1WithRSAEncryption') return 'sha1'
  if (name === 'sha256' || name === 'sha256WithRSAEncryption') return 'sha256'
  if (name === 'sha384' || name === 'sha384WithRSAEncryption') return 'sha384'
  if (name === 'sha512' || name === 'sha512WithRSAEncryption') return 'sha512'
  if (name === 'md5') return 'md5'
  return undefined
}

function verifyRsaOrEcdsa(pem: string, data: Buffer, signature: Buffer, digest: string): boolean {
  const key = crypto.createPublicKey(pem)
  const attempts: Array<() => boolean> = [
    () => crypto.verify(digest, data, key, signature),
    () => crypto.verify(digest, data, {
      key,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    }, signature),
    () => crypto.verify(digest, data, {
      key,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
    }, signature),
    () => {
      const verifier = crypto.createVerify(digest)
      verifier.update(data)
      verifier.end()
      return verifier.verify(pem, signature)
    },
  ]
  for (const attempt of attempts) {
    try {
      if (attempt()) return true
    } catch {
      // RSA-PSS, PKCS#1 v1.5 and ECDSA are tried in sequence.
    }
  }
  return false
}

function signerFromCms(certs: forge.pki.Certificate[], capture: { serialNumber?: string }): forge.pki.Certificate {
  const serial = typeof capture.serialNumber === 'string'
    ? forge.util.bytesToHex(capture.serialNumber).replace(/^0+/, '').toLowerCase()
    : ''
  if (!serial) return certs[0]
  return certs.find((cert) => cert.serialNumber.replace(/^0+/, '').toLowerCase() === serial) || certs[0]
}

export interface CmsVerification {
  ok: boolean
  certificates: forge.pki.Certificate[]
  signer: forge.pki.Certificate
  signingTime?: Date
  reason?: string
}

export function verifyDetachedCms(der: Buffer, signedContent: Buffer): CmsVerification {
  const fromDer = forge.asn1.fromDer as unknown as (input: string, options: { parseAllBytes: boolean; strict: boolean }) => forge.asn1.Asn1
  const p7Asn1 = fromDer(der.toString('binary'), { parseAllBytes: false, strict: false })
  const message = forge.pkcs7.messageFromAsn1(p7Asn1) as forge.pkcs7.Captured<forge.pkcs7.PkcsSignedData>
  const certs = (message.certificates || []) as forge.pki.Certificate[]
  if (!certs.length) {
    return { ok: false, certificates: [], signer: undefined as unknown as forge.pki.Certificate, reason: 'PKCS#7 sem certificado do assinante' }
  }
  const capture = message.rawCapture
  if (!capture?.signature) {
    return { ok: false, certificates: certs, signer: certs[0], reason: 'PKCS#7 sem valor de assinatura' }
  }
  const signer = signerFromCms(certs, capture)
  const signature = Buffer.from(capture.signature as string, 'binary')
  const digestOid = oidOf(capture.digestAlgorithm)
  const digest = digestName(digestOid) || 'sha256'
  const attrs = (capture.authenticatedAttributes || []) as forge.asn1.Asn1[]

  if (attrs.length) {
    const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs)
    const signedAttrs = Buffer.from(forge.asn1.toDer(set).getBytes(), 'binary')
    const pem = forge.pki.certificateToPem(signer)
    const cryptoOk = verifyRsaOrEcdsa(pem, signedAttrs, signature, digest)
    if (!cryptoOk) {
      return { ok: false, certificates: certs, signer, reason: 'A assinatura criptográfica do PKCS#7 não confere' }
    }

    const contentDigest = crypto.createHash(digest).update(signedContent).digest()
    let storedDigest: Buffer | undefined
    for (const attr of attrs) {
      const children = Array.isArray(attr.value) ? attr.value as forge.asn1.Asn1[] : []
      if (oidOf(children[0]) !== '1.2.840.113549.1.9.4') continue
      storedDigest = attrValueBytes(attr)
    }
    if (!storedDigest || !storedDigest.equals(contentDigest)) {
      return {
        ok: false,
        certificates: certs,
        signer,
        signingTime: signingTimeFromAttrs(attrs),
        reason: 'O hash do PDF (ByteRange) não corresponde ao messageDigest da assinatura — o arquivo foi alterado ou o intervalo assinado é inválido',
      }
    }

    return { ok: true, certificates: certs, signer, signingTime: signingTimeFromAttrs(attrs) }
  }

  const pem = forge.pki.certificateToPem(signer)
  const cryptoOk = verifyRsaOrEcdsa(pem, signedContent, signature, digest)
  if (!cryptoOk) {
    return { ok: false, certificates: certs, signer, reason: 'A assinatura criptográfica do PKCS#7 não confere' }
  }
  return { ok: true, certificates: certs, signer }
}
