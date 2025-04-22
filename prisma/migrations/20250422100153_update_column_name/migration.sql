/*
  Warnings:

  - You are about to drop the column `totalFollowers` on the `UserStore` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserStore" DROP COLUMN "totalFollowers",
ADD COLUMN     "totalFavoriters" INTEGER NOT NULL DEFAULT 0;
