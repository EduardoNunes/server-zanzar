/*
  Warnings:

  - You are about to drop the column `productCategoryId` on the `Product` table. All the data in the column will be lost.
  - Added the required column `productSubCategoryId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_productCategoryId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "productCategoryId",
ADD COLUMN     "productSubCategoryId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "ProductSubCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "ProductSubCategory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productSubCategoryId_fkey" FOREIGN KEY ("productSubCategoryId") REFERENCES "ProductSubCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubCategory" ADD CONSTRAINT "ProductSubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
