import jwt from 'jsonwebtoken'

function secret(): string {
  const value = process.env.JWT_SECRET
  if (!value) {
    throw new Error('JWT_SECRET é obrigatório.')
  }
  return value
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, secret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): { sub: string } {
  const payload = jwt.verify(token, secret())
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new Error('Token inválido')
  }
  return { sub: payload.sub }
}
