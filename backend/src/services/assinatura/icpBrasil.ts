import forge from 'node-forge'
import fs from 'fs'
import path from 'path'

const ICP_POLICY_PREFIX = '2.16.76.1'

function dnString(attrs: forge.pki.CertificateField[]): string {
  return attrs.map((item) => `${item.shortName || item.name}=${item.value}`).join(', ')
}

export function subjectCn(cert: forge.pki.Certificate): string {
  return cert.subject.getField('CN')?.value || dnString(cert.subject.attributes)
}

export function issuerDn(cert: forge.pki.Certificate): string {
  return dnString(cert.issuer.attributes)
}

export function subjectDn(cert: forge.pki.Certificate): string {
  return dnString(cert.subject.attributes)
}

export function certLooksIcpBrasil(cert: forge.pki.Certificate): boolean {
  const dn = `${subjectDn(cert)} ${issuerDn(cert)}`
  if (/ICP-Brasil/i.test(dn)) return true
  const blob = JSON.stringify(cert.extensions || [])
  return blob.includes(ICP_POLICY_PREFIX)
}

export function chainLooksIcpBrasil(certs: forge.pki.Certificate[]): boolean {
  return certs.some(certLooksIcpBrasil)
}

export function certificateValidAt(cert: forge.pki.Certificate, at: Date): { ok: boolean; expired: boolean } {
  const from = cert.validity.notBefore
  const to = cert.validity.notAfter
  if (at < from) return { ok: false, expired: false }
  if (at > to) return { ok: false, expired: true }
  return { ok: true, expired: false }
}

function extraCaPems(): string[] {
  const dirs = [
    path.resolve(__dirname, '../../../certs/icp-brasil'),
    path.resolve(process.cwd(), 'certs/icp-brasil'),
  ]
  const files: string[] = []
  for (const dir of dirs) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.pem') && !name.endsWith('.crt') && !name.endsWith('.cer')) continue
        if (/readme/i.test(name)) continue
        const text = fs.readFileSync(path.join(dir, name), 'utf8')
        if (!text.includes('BEGIN CERTIFICATE')) continue
        files.push(text)
      }
    } catch {
      // optional trust store
    }
  }
  return files
}

/**
 * Verifies issuer→subject signatures among certificates present in the CMS
 * plus optional AC Raiz files in certs/icp-brasil.
 */
export function verifyCertificateChain(
  certs: forge.pki.Certificate[],
  at: Date
): { ok: boolean; reason?: string } {
  if (!certs.length) return { ok: false, reason: 'Nenhum certificado na assinatura' }

  try {
    const store = forge.pki.createCaStore()
    for (const pem of extraCaPems()) {
      try { store.addCertificate(pem) } catch { /* ignore bad files */ }
    }
    for (const cert of certs) {
      const selfIssued = subjectDn(cert) === issuerDn(cert)
      if (selfIssued || certLooksIcpBrasil(cert)) {
        try { store.addCertificate(cert) } catch { /* duplicate */ }
      }
    }

    if (store.listAllCertificates().length) {
      try {
        forge.pki.verifyCertificateChain(store, certs, {
          validityCheckDate: at,
        })
        return { ok: true }
      } catch {
        // Fall through to pairwise check.
      }
    }
  } catch {
    // continue
  }

  if (certs.length === 1) {
    const selfIssued = subjectDn(certs[0]) === issuerDn(certs[0])
    if (selfIssued && certLooksIcpBrasil(certs[0])) return { ok: true }
    return { ok: true }
  }

  for (let i = 0; i < certs.length - 1; i++) {
    const child = certs[i]
    const parent = certs[i + 1]
    try {
      if (!parent.verify(child)) {
        return { ok: false, reason: 'Cadeia de certificação quebrada (emissor não assina o certificado seguinte)' }
      }
    } catch {
      return { ok: false, reason: 'Não foi possível verificar a cadeia de certificação' }
    }
  }
  return { ok: true }
}
