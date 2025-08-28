/*
  Warnings:

  - You are about to drop the column `productId` on the `ProductReview` table. All the data in the column will be lost.
  - You are about to drop the column `storeId` on the `StoreReview` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[orderItemId,profileId]` on the table `ProductReview` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderItemId,profileId]` on the table `StoreReview` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orderItemId` to the `ProductReview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderItemId` to the `StoreReview` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ProductReview" DROP CONSTRAINT "ProductReview_productId_fkey";

-- DropForeignKey
ALTER TABLE "StoreReview" DROP CONSTRAINT "StoreReview_storeId_fkey";

-- DropIndex
DROP INDEX "ProductReview_productId_profileId_key";

-- DropIndex
DROP INDEX "StoreReview_storeId_profileId_key";

-- AlterTable
ALTER TABLE "ProductReview" DROP COLUMN "productId",
ADD COLUMN     "orderItemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StoreReview" DROP COLUMN "storeId",
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "orderItemId" TEXT NOT NULL,
ADD COLUMN     "userStoreId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_orderItemId_profileId_key" ON "ProductReview"("orderItemId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreReview_orderItemId_profileId_key" ON "StoreReview"("orderItemId", "profileId");

-- AddForeignKey
ALTER TABLE "StoreReview" ADD CONSTRAINT "StoreReview_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReview" ADD CONSTRAINT "StoreReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
