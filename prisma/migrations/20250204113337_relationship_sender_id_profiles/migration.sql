-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "referenceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
