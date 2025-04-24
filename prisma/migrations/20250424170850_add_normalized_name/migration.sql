/*
  Warnings:

  - A unique constraint covering the columns `[normalizedName]` on the table `ProductCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[normalizedName,categoryId]` on the table `ProductSubCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `normalizedName` to the `ProductCategory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `normalizedName` to the `ProductSubCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ProductCategory_name_key";

-- DropIndex
DROP INDEX "ProductSubCategory_name_categoryId_key";

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "normalizedName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProductSubCategory" ADD COLUMN     "normalizedName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_normalizedName_key" ON "ProductCategory"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubCategory_normalizedName_categoryId_key" ON "ProductSubCategory"("normalizedName", "categoryId");
