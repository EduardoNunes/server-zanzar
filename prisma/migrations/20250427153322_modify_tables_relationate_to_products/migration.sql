/*
  Warnings:

  - You are about to drop the column `basePrice` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `ProductVariant` table. All the data in the column will be lost.
  - Made the column `userStoreId` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `position` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `colorname` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Made the column `colorCode` on table `ProductVariant` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_userStoreId_fkey";

-- DropIndex
DROP INDEX "ProductVariant_sku_key";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "userStoreId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "position" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "basePrice",
DROP COLUMN "color",
DROP COLUMN "price",
DROP COLUMN "size",
DROP COLUMN "sku",
DROP COLUMN "stock",
ADD COLUMN     "colorname" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "colorCode" SET NOT NULL;

-- CreateTable
CREATE TABLE "ProductVariantSize" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,

    CONSTRAINT "ProductVariantSize_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userStoreId_fkey" FOREIGN KEY ("userStoreId") REFERENCES "UserStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantSize" ADD CONSTRAINT "ProductVariantSize_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
