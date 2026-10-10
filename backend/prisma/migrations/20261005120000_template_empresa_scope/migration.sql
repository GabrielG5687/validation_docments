-- AlterTable
ALTER TABLE "templates" ADD COLUMN "empresaId" TEXT;

-- CreateIndex
CREATE INDEX "templates_empresaId_idx" ON "templates"("empresaId");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
