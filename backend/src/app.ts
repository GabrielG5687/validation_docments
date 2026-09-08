import express, { Application, Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { globalRateLimiter } from './middlewares/rateLimiter'
import { errorHandler } from './middlewares/errorHandler'
import { authenticate } from './middlewares/auth'
import { requireRole } from './middlewares/roles'
import authRoutes from './routes/auth'
import usuariosRoutes from './routes/usuarios'
import templatesRoutes from './routes/templates'
import regrasRoutes from './routes/regras'
import documentosRoutes from './routes/documentos'
import verificarRoutes from './routes/verificar'
import relatoriosRoutes from './routes/relatorios'
import { dashboard } from './controllers/relatoriosController'

const app: Application = express()

// ─── Security headers ──────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Ensure all security headers are active
    xContentTypeOptions: true,       // X-Content-Type-Options: nosniff
    frameguard: { action: 'deny' },  // X-Frame-Options: DENY
    hsts: {
      maxAge: 31536000,              // 1 year
      includeSubDomains: true,
      preload: true,
    },
    crossOriginEmbedderPolicy: false, // allow presigned MinIO URLs in iframes
  })
)

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// ─── Body parsers ──────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Rate limiters ─────────────────────────────────────────────────────────
// Applied before routes so every request is subject to rate limiting.
app.use(globalRateLimiter)

// ─── Health check (unauthenticated) ───────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── API Routes ────────────────────────────────────────────────────────────
// Auth — public (login e cadastro)
app.use('/api/auth', authRoutes)

// Usuarios — requires authentication + admin role
app.use('/api/usuarios', authenticate, requireRole('admin'), usuariosRoutes)

// Templates — all authenticated users (GET); admin only (POST/PUT/DELETE, enforced in route)
app.use('/api/templates', authenticate, templatesRoutes)

// Regras — requires authentication + admin role
app.use('/api/regras', authenticate, requireRole('admin'), regrasRoutes)

app.use('/api/documentos', authenticate, documentosRoutes)
app.use('/api/verificar', verificarRoutes)
app.use('/api/relatorios', authenticate, relatoriosRoutes)
app.get('/api/dashboard', authenticate, dashboard)

// ─── 404 handler ──────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

// ─── Global error handler ─────────────────────────────────────────────────
// Must be the last middleware. Handles all errors forwarded via next(err).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  errorHandler(err, req, res, next)
})

export default app
