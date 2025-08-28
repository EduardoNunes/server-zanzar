/*
  Warnings:

  - You are about to drop the column `orderId` on the `StoreReview` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StoreReview" DROP CONSTRAINT "StoreReview_orderId_fkey";

-- AlterTable
ALTER TABLE "StoreReview" DROP COLUMN "orderId";
