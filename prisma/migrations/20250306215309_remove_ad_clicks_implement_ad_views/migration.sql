/*
  Warnings:

  - You are about to drop the `AdClicks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AdClicks" DROP CONSTRAINT "AdClicks_adId_fkey";

-- DropForeignKey
ALTER TABLE "AdClicks" DROP CONSTRAINT "AdClicks_profileId_fkey";

-- AlterTable
ALTER TABLE "AdViews" ADD COLUMN     "lastView" TIMESTAMP(3),
ADD COLUMN     "manyClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantView" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "AdClicks";
