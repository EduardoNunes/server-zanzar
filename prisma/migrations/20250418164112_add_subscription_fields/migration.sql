-- AlterTable
ALTER TABLE "UserStore" ADD COLUMN     "lastSubscriptionPayment" TIMESTAMP(3),
ADD COLUMN     "productFeePercentage" INTEGER,
ADD COLUMN     "subscriptionAmount" INTEGER;
