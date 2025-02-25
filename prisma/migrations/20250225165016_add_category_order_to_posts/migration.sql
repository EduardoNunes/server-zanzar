/*
  Warnings:

  - Added the required column `order` to the `Posts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Posts" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Padrão',
ADD COLUMN     "order" INTEGER NOT NULL;
