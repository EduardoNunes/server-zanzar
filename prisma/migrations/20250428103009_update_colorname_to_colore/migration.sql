/*
  Warnings:

  - You are about to drop the column `colorName` on the `ProductVariant` table. All the data in the column will be lost.
  - Added the required column `name` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "colorName",
ADD COLUMN     "name" TEXT NOT NULL;
