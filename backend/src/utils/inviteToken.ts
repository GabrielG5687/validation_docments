import { createHash, randomBytes } from 'crypto'

export function gerarTokenConvite(): string {
  return randomBytes(32).toString('hex')
}

export function hashTokenConvite(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export default { gerarTokenConvite, hashTokenConvite }
