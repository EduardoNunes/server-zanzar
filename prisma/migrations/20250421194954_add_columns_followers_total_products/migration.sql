-- AlterTable
ALTER TABLE "UserStore" ADD COLUMN     "totalFollowers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalProducts" INTEGER NOT NULL DEFAULT 0;
