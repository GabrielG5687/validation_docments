-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "senhaHash" TEXT;

UPDATE "usuarios"
SET "senhaHash" = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8sKqKqKqKqKqKqKqKqKqKqKqKqKqKq'
WHERE "senhaHash" IS NULL;

ALTER TABLE "usuarios" ALTER COLUMN "senhaHash" SET NOT NULL;

DROP INDEX IF EXISTS "usuarios_firebaseUid_key";
ALTER TABLE "usuarios" DROP COLUMN "firebaseUid";
