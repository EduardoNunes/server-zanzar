/*
  Warnings:

  - You are about to drop the `InviteLimit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "InviteLimit" DROP CONSTRAINT "InviteLimit_profileId_fkey";

-- AlterTable
ALTER TABLE "Profiles" ADD COLUMN     "invites" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "InviteLimit";
