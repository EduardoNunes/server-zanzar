/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `Profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Profiles_cpf_key" ON "Profiles"("cpf");
