-- AlterTable: Add netTransfer column to account_snapshots
ALTER TABLE "account_snapshots" ADD COLUMN "net_transfer" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable: transfers (出入金记录)
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "binance_trans_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'USDT',
    "time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfers_binance_trans_id_key" ON "transfers"("binance_trans_id");

-- CreateIndex
CREATE INDEX "transfers_user_id_time_idx" ON "transfers"("user_id", "time");

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
