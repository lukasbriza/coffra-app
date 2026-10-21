-- DropIndex
DROP INDEX "Transaction_accountId_idx";

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_createdAt_id_idx" ON "Transaction"("accountId", "date", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Transaction_date_createdAt_id_idx" ON "Transaction"("date", "createdAt", "id");
