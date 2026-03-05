-- Migration: Add OKX support
-- Adds multi-exchange support: passphrase for OKX, exchange field on trades/transfers

-- 1. api_configs: 新增 passphrase_encrypted 列（OKX 专用，可为空）
ALTER TABLE "api_configs" ADD COLUMN IF NOT EXISTS "passphrase_encrypted" TEXT;

-- 2. positions: 新增 exchange 列，默认 binance
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "exchange" TEXT NOT NULL DEFAULT 'binance';

-- 3. trades: 新增 exchange 列，默认 binance
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "exchange" TEXT NOT NULL DEFAULT 'binance';

-- 4. trades: 重命名列 binance_order_id -> exchange_order_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='trades' AND column_name='binance_order_id'
  ) THEN
    ALTER TABLE "trades" RENAME COLUMN "binance_order_id" TO "exchange_order_id";
  END IF;
END $$;

-- 5. trades: 删除旧的单列唯一索引（如果存在）
DROP INDEX IF EXISTS "trades_binance_order_id_key";

-- 6. trades: 创建新的复合唯一索引 (exchange_order_id, exchange)
CREATE UNIQUE INDEX IF NOT EXISTS "trades_exchange_order_id_exchange_key"
  ON "trades"("exchange_order_id", "exchange");

-- 7. transfers: 新增 exchange 列，默认 binance
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "exchange" TEXT NOT NULL DEFAULT 'binance';

-- 8. transfers: 重命名列 binance_trans_id -> exchange_trans_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='transfers' AND column_name='binance_trans_id'
  ) THEN
    ALTER TABLE "transfers" RENAME COLUMN "binance_trans_id" TO "exchange_trans_id";
  END IF;
END $$;

-- 9. transfers: 删除旧的单列唯一索引（如果存在）
DROP INDEX IF EXISTS "transfers_binance_trans_id_key";

-- 10. transfers: 创建新的复合唯一索引 (exchange_trans_id, exchange)
CREATE UNIQUE INDEX IF NOT EXISTS "transfers_exchange_trans_id_exchange_key"
  ON "transfers"("exchange_trans_id", "exchange");
