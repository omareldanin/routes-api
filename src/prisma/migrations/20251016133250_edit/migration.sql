/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Delivery` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Delivery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "code" TEXT NOT NULL,
ALTER COLUMN "worksFroms" SET DEFAULT '9am',
ALTER COLUMN "worksFroms" SET DATA TYPE TEXT,
ALTER COLUMN "worksTo" SET DEFAULT '5pm',
ALTER COLUMN "worksTo" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_code_key" ON "Delivery"("code");
