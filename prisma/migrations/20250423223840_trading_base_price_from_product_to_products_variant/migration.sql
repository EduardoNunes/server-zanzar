/*
  Warnings:

  - You are about to drop the column `basePrice` on the `Product` table. All the data in the column will be lost.
  - Added the required column `basePrice` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "basePrice";

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "basePrice" INTEGER NOT NULL;
