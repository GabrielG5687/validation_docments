import { Client as MinioClient } from 'minio'

// Bucket names used throughout the application
export const BUCKET_DOCUMENTOS = 'documentos-pdf'
export const BUCKET_QRCODES = 'qrcodes'

function createMinioClient(): MinioClient {
  const endPoint = process.env.MINIO_ENDPOINT
  const port = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : 9000
  const useSSL = process.env.MINIO_USE_SSL === 'true'
  const accessKey = process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_SECRET_KEY

  if (!endPoint || !accessKey || !secretKey) {
    throw new Error('MinIO não configurado')
  }

  return new MinioClient({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  })
}

let minioClient: MinioClient | undefined

export function getMinioClient(): MinioClient {
  if (!minioClient) minioClient = createMinioClient()
  return minioClient
}

/**
 * Ensures required private buckets exist.
 * Called once during application startup.
 */
export async function ensureBucketsExist(): Promise<void> {
  const buckets = [BUCKET_DOCUMENTOS, BUCKET_QRCODES]

  for (const bucket of buckets) {
    const exists = await getMinioClient().bucketExists(bucket)
    if (!exists) {
      // Create bucket; by default MinIO buckets are private (no public policy)
      await getMinioClient().makeBucket(bucket, process.env.MINIO_REGION ?? 'us-east-1')
      console.info(`[MinIO] Bucket criado: ${bucket}`)
    }
  }
}

export default {
  bucketExists: (bucket: string) => getMinioClient().bucketExists(bucket),
  makeBucket: (bucket: string, region?: string) =>
    getMinioClient().makeBucket(bucket, region),
  putObject: (...args: Parameters<MinioClient['putObject']>) =>
    getMinioClient().putObject(...args),
  presignedGetObject: (...args: Parameters<MinioClient['presignedGetObject']>) =>
    getMinioClient().presignedGetObject(...args),
  removeObject: (...args: Parameters<MinioClient['removeObject']>) =>
    getMinioClient().removeObject(...args),
  getObject: (...args: Parameters<MinioClient['getObject']>) =>
    getMinioClient().getObject(...args),
}
