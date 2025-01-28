/*
  Warnings:

  - You are about to drop the column `userId` on the `AdClicks` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `AdViews` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Comments` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Likes` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Posts` table. All the data in the column will be lost.
  - Added the required column `profileId` to the `AdClicks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profileId` to the `AdViews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profileId` to the `Comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profileId` to the `Likes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profileId` to the `Posts` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AdClicks" DROP CONSTRAINT "AdClicks_userId_fkey";

-- DropForeignKey
ALTER TABLE "AdViews" DROP CONSTRAINT "AdViews_userId_fkey";

-- DropForeignKey
ALTER TABLE "Comments" DROP CONSTRAINT "Comments_userId_fkey";

-- DropForeignKey
ALTER TABLE "Likes" DROP CONSTRAINT "Likes_userId_fkey";

-- DropForeignKey
ALTER TABLE "Posts" DROP CONSTRAINT "Posts_userId_fkey";

-- AlterTable
ALTER TABLE "AdClicks" DROP COLUMN "userId",
ADD COLUMN     "profileId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AdViews" DROP COLUMN "userId",
ADD COLUMN     "profileId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Comments" DROP COLUMN "userId",
ADD COLUMN     "profileId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Likes" DROP COLUMN "userId",
ADD COLUMN     "profileId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Posts" DROP COLUMN "userId",
ADD COLUMN     "profileId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Posts" ADD CONSTRAINT "Posts_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Likes" ADD CONSTRAINT "Likes_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdViews" ADD CONSTRAINT "AdViews_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdClicks" ADD CONSTRAINT "AdClicks_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
