-- CreateEnum
CREATE TYPE "AuthSource" AS ENUM ('oidc');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('bank', 'cash');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense', 'transfer');

-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('out', 'in');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "authSource" "AuthSource" NOT NULL DEFAULT 'oidc',
    "externalSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "categoryId" UUID,
    "transferPairId" UUID,
    "transferDirection" "TransferDirection",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authSource_externalSubject_key" ON "User"("authSource", "externalSubject");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transferPairId_transferDirection_key" ON "Transaction"("transferPairId", "transferDirection");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints (not expressible in Prisma schema)
ALTER TABLE "Account" ADD CONSTRAINT currency_iso CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE "Transaction" ADD CONSTRAINT amount_positive CHECK (amount > 0);

ALTER TABLE "Transaction" ADD CONSTRAINT transfer_shape CHECK (
  (type = 'transfer' AND "transferPairId" IS NOT NULL AND "transferDirection" IS NOT NULL AND "categoryId" IS NULL)
  OR (type <> 'transfer' AND "transferPairId" IS NULL AND "transferDirection" IS NULL)
);
