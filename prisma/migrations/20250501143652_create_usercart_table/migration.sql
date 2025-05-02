-- CreateTable
CREATE TABLE "UserCart" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "productVariantSizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCart_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserCart" ADD CONSTRAINT "UserCart_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCart" ADD CONSTRAINT "UserCart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCart" ADD CONSTRAINT "UserCart_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCart" ADD CONSTRAINT "UserCart_productVariantSizeId_fkey" FOREIGN KEY ("productVariantSizeId") REFERENCES "ProductVariantSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
