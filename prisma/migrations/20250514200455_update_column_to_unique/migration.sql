/*
  Warnings:

  - A unique constraint covering the columns `[asaasPaymentId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Order_asaasPaymentId_key" ON "Order"("asaasPaymentId");
