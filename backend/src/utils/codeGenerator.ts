import { PrismaClient } from '@prisma/client'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Generates a random 4-character segment from the allowed character set.
 */
function randomPart(): string {
  return Array.from({ length: 4 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

/**
 * Generates a unique verification code in the format `XXXX-XXXX` using only
 * uppercase letters and digits [A-Z0-9].
 *
 * Checks the `documentos` table to ensure the generated code has never been
 * used before, retrying until a genuinely unique code is found.
 *
 * Requirements: 9.1, 9.2
 *
 * @param prisma - The Prisma client instance used to verify uniqueness.
 * @returns A promise that resolves to a unique code string, e.g. `"X7F9-32AB"`.
 */
export async function generateUniqueCode(prisma: PrismaClient): Promise<string> {
  let code: string
  let exists: boolean

  do {
    code = `${randomPart()}-${randomPart()}`
    const found = await prisma.documento.findUnique({
      where: { codigoVerificacao: code },
    })
    exists = found !== null
  } while (exists)

  return code
}
