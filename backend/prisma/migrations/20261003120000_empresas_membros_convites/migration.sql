-- CreateEnum
CREATE TYPE "PapelEmpresa" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "StatusConviteEmpresa" AS ENUM ('pendente', 'aceito', 'expirado', 'revogado');

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros_empresa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" "PapelEmpresa" NOT NULL DEFAULT 'MEMBER',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membros_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites_empresa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" "PapelEmpresa" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "status" "StatusConviteEmpresa" NOT NULL DEFAULT 'pendente',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "aceitoEm" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_empresa_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "entidades" ADD COLUMN "empresaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "membros_empresa_empresaId_usuarioId_key" ON "membros_empresa"("empresaId", "usuarioId");

-- CreateIndex
CREATE INDEX "membros_empresa_usuarioId_idx" ON "membros_empresa"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "convites_empresa_tokenHash_key" ON "convites_empresa"("tokenHash");

-- CreateIndex
CREATE INDEX "convites_empresa_empresaId_status_idx" ON "convites_empresa"("empresaId", "status");

-- CreateIndex
CREATE INDEX "convites_empresa_email_idx" ON "convites_empresa"("email");

-- CreateIndex
CREATE INDEX "entidades_empresaId_idx" ON "entidades"("empresaId");

-- AddForeignKey
ALTER TABLE "membros_empresa" ADD CONSTRAINT "membros_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_empresa" ADD CONSTRAINT "membros_empresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites_empresa" ADD CONSTRAINT "convites_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites_empresa" ADD CONSTRAINT "convites_empresa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
