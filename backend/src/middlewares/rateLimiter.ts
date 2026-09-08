import rateLimit from 'express-rate-limit'

/**
 * Global rate limiter — applied to all authenticated endpoints.
 * Limit: 100 requests per minute per IP.
 *
 * Requirements: 10.6, 20.1
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
  skip: (req) => req.path.startsWith('/api/verificar/'),
})

/**
 * Public rate limiter — applied to unauthenticated verification routes
 * under /api/verificar/*.
 * Limit: 60 requests per minute per IP.
 *
 * Requirements: 10.6, 20.1
 */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
})

export default { globalRateLimiter, publicRateLimiter }
