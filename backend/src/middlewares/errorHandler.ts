import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

interface StructuredLog {
  timestamp: string
  endpoint: string
  method: string
  status: number
  message: string
  stack?: string
}

/**
 * Determine the HTTP status code and safe client message for a given error.
 */
function resolveError(err: unknown): { status: number; message: string } {
  if (typeof err === 'object' && err !== null && 'code' in err &&
      (err as { code?: unknown }).code === 'LIMIT_FILE_SIZE') {
    return { status: 413, message: 'O arquivo não pode exceder 20 MB' }
  }
  // Prisma known request errors (e.g. unique constraint violations)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return { status: 409, message: 'Conflito: registro duplicado.' }
      default:
        return { status: 503, message: 'Serviço de banco de dados temporariamente indisponível.' }
    }
  }

  // Prisma validation/initialization errors
  if (
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return { status: 503, message: 'Serviço de banco de dados temporariamente indisponível.' }
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return { status: 422, message: 'Dados de entrada inválidos.' }
  }

  // Express built-in JSON parse error (SyntaxError with body)
  if (err instanceof SyntaxError && 'body' in err) {
    return { status: 400, message: 'Corpo da requisição inválido.' }
  }

  // Generic HTTP errors with a status property
  if (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  ) {
    const httpErr = err as { status: number; message?: string }
    return {
      status: httpErr.status,
      message: httpErr.message ?? 'Erro na requisição.',
    }
  }

  return { status: 500, message: 'Erro interno do servidor.' }
}

/**
 * Global error handler middleware.
 *
 * - Formats 4xx/5xx responses without exposing stack traces or DB details.
 * - Logs errors in structured format: { timestamp, endpoint, method, status, message, stack }.
 * - Maps Prisma errors (P2002 → 409, others → 503) and Zod errors → 422.
 * - Returns HTTP 400 for malformed JSON bodies.
 *
 * Requirements: 19.3, 19.4, 19.5, 20.4
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const { status, message } = resolveError(err)

  const logEntry: StructuredLog = {
    timestamp: new Date().toISOString(),
    endpoint: req.originalUrl,
    method: req.method,
    status,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }

  // Log all errors; in production we still log the full stack internally
  // but never send it to the client.
  console.error('[ErrorHandler]', JSON.stringify(logEntry))

  res.status(status).json({ error: message })
}

export default errorHandler
