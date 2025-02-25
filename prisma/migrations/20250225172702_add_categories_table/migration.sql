-- CreateTable
CREATE TABLE "Categories" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "categories" TEXT NOT NULL,

    CONSTRAINT "Categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Categories_profileId_idx" ON "Categories"("profileId");

-- AddForeignKey
ALTER TABLE "Categories" ADD CONSTRAINT "Categories_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
