ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "categoria" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "documentos_usuarioId_hashSha256_key"
  ON "documentos" ("usuarioId", "hashSha256");
CREATE INDEX IF NOT EXISTS "documentos_criadoEm_idx" ON "documentos" ("criadoEm");
