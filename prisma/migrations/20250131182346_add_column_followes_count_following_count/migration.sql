/*
  Warnings:

  - A unique constraint covering the columns `[followerId,followingId]` on the table `Followers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Profiles" ADD COLUMN     "followersCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "followingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Followers_followerId_followingId_key" ON "Followers"("followerId", "followingId");
