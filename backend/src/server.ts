import 'dotenv/config'
import app from './app'
import { ensureBuckets } from './services/minioService'
import { seedDevelopUser } from './services/seedDevelopUser'

const PORT = process.env.PORT ?? 3000

async function start(): Promise<void> {
  try {
    await ensureBuckets()
  } catch (error) {
    console.error('[Server] MinIO indisponível durante inicialização', error)
  }

  try {
    await seedDevelopUser()
  } catch (error) {
    console.error('[Server] Falha ao criar usuário develop', error)
  }

  app.listen(PORT, () => console.info(`[Server] Listening on port ${PORT}`))
}

void start()
