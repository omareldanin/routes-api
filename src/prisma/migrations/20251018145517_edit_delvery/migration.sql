-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "deliveryPrecent" INTEGER;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "latitude" TEXT,
ADD COLUMN     "longitudes" TEXT;
