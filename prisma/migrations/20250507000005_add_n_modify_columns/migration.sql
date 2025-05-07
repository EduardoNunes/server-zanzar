/*
  Warnings:

  - You are about to drop the column `originalName` on the `Profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Profiles" DROP COLUMN "originalName",
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "phoneNumber" TEXT;
