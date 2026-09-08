import minioClient, {
  BUCKET_DOCUMENTOS,
  BUCKET_QRCODES,
  ensureBucketsExist,
} from '../config/minio'

/**
 * Custom error thrown when the MinIO storage service is unavailable.
 * The `status` property is read by the global `errorHandler` middleware,
 * which maps it to an HTTP 503 response.
 *
 * Requirements: 15.4
 */
export class StorageError extends Error {
  public readonly status: number = 503

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'StorageError'
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`
    }
  }
}

/**
 * Wraps a MinIO operation and converts any connectivity errors into a
 * `StorageError` so the global error handler can return HTTP 503.
 */
async function withStorage<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof StorageError) throw err
    throw new StorageError(
      'Serviço de armazenamento temporariamente indisponível',
      err
    )
  }
}

/**
 * Uploads a file to the specified MinIO bucket.
 *
 * Requirements: 15.1, 15.2
 *
 * @param bucket      - Target bucket name.
 * @param key         - Object key (UUID-based filename).
 * @param buffer      - File contents.
 * @param contentType - MIME type of the file.
 * @returns The object key used to store the file.
 */
export async function uploadFile(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await withStorage(() =>
    minioClient.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    })
  )
  return key
}

/**
 * Generates a pre-signed URL for temporary access to an object.
 *
 * Requirements: 15.3
 *
 * @param bucket        - Bucket containing the object.
 * @param key           - Object key.
 * @param expirySeconds - URL validity in seconds (max 604 800 s / 7 days for MinIO).
 * @returns A pre-signed HTTPS URL.
 */
export async function getPresignedUrl(
  bucket: string,
  key: string,
  expirySeconds: number
): Promise<string> {
  const expiry = Math.min(Math.max(1, Math.floor(expirySeconds)), 24 * 60 * 60)
  return withStorage(() =>
    minioClient.presignedGetObject(bucket, key, expiry)
  )
}

/**
 * Deletes an object from the specified MinIO bucket.
 *
 * Requirements: 15.1
 *
 * @param bucket - Bucket containing the object.
 * @param key    - Object key to delete.
 */
export async function deleteFile(bucket: string, key: string): Promise<void> {
  await withStorage(() => minioClient.removeObject(bucket, key))
}

export async function downloadFile(bucket: string, key: string): Promise<Buffer> {
  return withStorage(async () => {
    const stream = await minioClient.getObject(bucket, key)
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return Buffer.concat(chunks)
  })
}

/**
 * Ensures both application buckets (`documentos-pdf` and `qrcodes`) exist.
 * Creates them as private buckets if they are missing.
 * Called once at application startup.
 *
 * Requirements: 15.1, 15.5
 */
export async function ensureBuckets(): Promise<void> {
  await withStorage(() => ensureBucketsExist())
}

export { BUCKET_DOCUMENTOS, BUCKET_QRCODES }
