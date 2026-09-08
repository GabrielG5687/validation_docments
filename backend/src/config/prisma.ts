import { PrismaClient } from '@prisma/client'

// Singleton PrismaClient to avoid multiple connections in development
// (Next.js / hot-reload workaround pattern applies here too)
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}

export default prisma
