/*
  Warnings:

  - You are about to drop the column `code` on the `Client` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Client_code_key";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "code";
