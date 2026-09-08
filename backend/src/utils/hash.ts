import { createHash } from 'crypto'

/**
 * Computes the SHA-256 hash of the given buffer and returns it as a
 * lowercase hexadecimal string.
 *
 * Requirements: 5.4, 11.1
 *
 * @param buffer - The binary data to hash.
 * @returns A 64-character lowercase hex string.
 */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
