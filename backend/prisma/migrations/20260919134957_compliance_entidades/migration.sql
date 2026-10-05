-- CreateEnum
CREATE TYPE "TipoEntidade" AS ENUM ('empresa', 'pessoa');

-- CreateEnum
CREATE TYPE "DossieStatus" AS ENUM ('em_compliance', 'pendente', 'aprovado');

-- CreateEnum
CREATE TYPE "ValidadeStatus" AS ENUM ('valido', 'proximo_vencimento', 'vencido', 'sem_validade');

-- AlterTable
ALTER TABLE "documentos" ADD COLUMN     "dataEmissao" TIMESTAMP(3),
ADD COLUMN     "dataValidade" TIMESTAMP(3),
ADD COLUMN     "diasParaVencer" INTEGER,
ADD COLUMN     "dossieItemId" TEXT,
ADD COLUMN     "entidadeId" TEXT,
ADD COLUMN     "renovacaoNecessaria" BOOLEAN DEFAULT false,
ADD COLUMN     "statusValidade" "ValidadeStatus";

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "validadeDias" INTEGER;

-- CreateTable
CREATE TABLE "entidades" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEntidade" NOT NULL,
    "nome" TEXT NOT NULL,
    "documentoIdentificador" TEXT,
    "cnpjOuCpf" TEXT,
    "responsavelId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossies" (
    "id" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "DossieStatus" NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossie_itens" (
    "id" TEXT NOT NULL,
    "dossieId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "documentoId" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossie_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "documentoId" TEXT,
    "dossieId" TEXT,
    "entidadeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entidades_responsavelId_idx" ON "entidades"("responsavelId");

-- CreateIndex
CREATE INDEX "dossies_entidadeId_idx" ON "dossies"("entidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "dossie_itens_dossieId_templateId_key" ON "dossie_itens"("dossieId", "templateId");

-- CreateIndex
CREATE INDEX "dossie_itens_dossieId_idx" ON "dossie_itens"("dossieId");

-- CreateIndex
CREATE INDEX "dossie_itens_templateId_idx" ON "dossie_itens"("templateId");

-- CreateIndex
CREATE INDEX "notificacoes_destinatarioId_lida_idx" ON "notificacoes"("destinatarioId", "lida");

-- CreateIndex
CREATE INDEX "notificacoes_criadoEm_idx" ON "notificacoes"("criadoEm");

-- CreateIndex
CREATE INDEX "documentos_entidadeId_idx" ON "documentos"("entidadeId");

-- CreateIndex
CREATE INDEX "documentos_statusValidade_idx" ON "documentos"("statusValidade");

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_dossieItemId_fkey" FOREIGN KEY ("dossieItemId") REFERENCES "dossie_itens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossies" ADD CONSTRAINT "dossies_entidadeId_fkey" FOREIGN KEY ("entidadeId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossie_itens" ADD CONSTRAINT "dossie_itens_dossieId_fkey" FOREIGN KEY ("dossieId") REFERENCES "dossies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossie_itens" ADD CONSTRAINT "dossie_itens_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossie_itens" ADD CONSTRAINT "dossie_itens_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
