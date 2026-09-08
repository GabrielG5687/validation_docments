-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('usuario', 'validador', 'coordenador', 'admin');

-- CreateEnum
CREATE TYPE "StatusTemplate" AS ENUM ('rascunho', 'ativo', 'inativo');

-- CreateEnum
CREATE TYPE "TipoRegra" AS ENUM ('campo_obrigatorio', 'formato', 'intervalo', 'calculo');

-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('processando', 'aguardando_validacao', 'aguardando_revisao', 'em_revisao', 'aprovado', 'reprovado', 'reprovado_automatico', 'erro_extracao');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'usuario',
    "status" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "status" "StatusTemplate" NOT NULL DEFAULT 'rascunho',
    "versaoAtual" TEXT NOT NULL DEFAULT '1.0',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versoes" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_validacao" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoRegra" NOT NULL,
    "parametros" JSONB NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_validacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "minioKey" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "dadosExtraidos" JSONB,
    "status" "StatusDocumento" NOT NULL DEFAULT 'processando',
    "codigoVerificacao" TEXT,
    "qrcodeKey" TEXT,
    "documentoOrigemId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validacoes" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "validadorId" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_regra" (
    "id" TEXT NOT NULL,
    "validacaoId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "valorEncontrado" TEXT,
    "criterio" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_regra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_status" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "statusAnterior" TEXT,
    "statusNovo" TEXT NOT NULL,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_firebaseUid_key" ON "usuarios"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_codigoVerificacao_key" ON "documentos"("codigoVerificacao");

-- CreateIndex
CREATE INDEX "documentos_usuarioId_idx" ON "documentos"("usuarioId");

-- CreateIndex
CREATE INDEX "documentos_templateId_idx" ON "documentos"("templateId");

-- CreateIndex
CREATE INDEX "documentos_status_idx" ON "documentos"("status");

-- CreateIndex
CREATE INDEX "documentos_codigoVerificacao_idx" ON "documentos"("codigoVerificacao");

-- CreateIndex
CREATE INDEX "documentos_criadoEm_idx" ON "documentos"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_usuarioId_hashSha256_key" ON "documentos"("usuarioId", "hashSha256");

-- CreateIndex
CREATE INDEX "historico_status_documentoId_idx" ON "historico_status"("documentoId");

-- AddForeignKey
ALTER TABLE "template_versoes" ADD CONSTRAINT "template_versoes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_validacao" ADD CONSTRAINT "regras_validacao_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validacoes" ADD CONSTRAINT "validacoes_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validacoes" ADD CONSTRAINT "validacoes_validadorId_fkey" FOREIGN KEY ("validadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_regra" ADD CONSTRAINT "resultados_regra_validacaoId_fkey" FOREIGN KEY ("validacaoId") REFERENCES "validacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_regra" ADD CONSTRAINT "resultados_regra_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "regras_validacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status" ADD CONSTRAINT "historico_status_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

