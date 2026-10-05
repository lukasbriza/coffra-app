-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "tenantId" UUID;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "tenantId" UUID;
