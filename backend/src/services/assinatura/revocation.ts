import forge from 'node-forge'

function urlsFromCert(cert: forge.pki.Certificate): string[] {
  const blob = JSON.stringify(cert.extensions || [])
  const matches = blob.match(/https?:\/\/[^"\\\s]+/gi) || []
  return [...new Set(matches.filter((url) => /\.crl(\b|$)/i.test(url) || /crl/i.test(url)))]
}

function serialOf(cert: forge.pki.Certificate): string {
  return cert.serialNumber.replace(/^0+/, '').toLowerCase()
}

export async function checkRevocation(
  cert: forge.pki.Certificate
): Promise<{ revogado: boolean; verificado: boolean }> {
  const urls = urlsFromCert(cert).slice(0, 3)
  if (!urls.length) return { revogado: false, verificado: false }

  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!response.ok) continue
      const buf = Buffer.from(await response.arrayBuffer())
      const fromDer = forge.asn1.fromDer as unknown as (input: string, options: { parseAllBytes: boolean; strict: boolean }) => forge.asn1.Asn1
      const asn1 = fromDer(buf.toString('binary'), { parseAllBytes: false, strict: false })
      const crl = (forge.pki as unknown as {
        certificateRevocationListFromAsn1?: (node: forge.asn1.Asn1) => {
          revoked?: Array<{ serialNumber?: string }>
        }
      }).certificateRevocationListFromAsn1?.(asn1)
      const revoked = crl?.revoked || []
      const serial = serialOf(cert)
      const hit = revoked.some((item) => (item.serialNumber || '').replace(/^0+/, '').toLowerCase() === serial)
      return { revogado: hit, verificado: true }
    } catch {
      // try next CDP
    }
  }
  return { revogado: false, verificado: false }
}
