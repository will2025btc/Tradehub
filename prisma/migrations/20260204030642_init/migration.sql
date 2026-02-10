-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "google_id" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "image" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'binance',
    "api_key_encrypted" TEXT NOT NULL,
    "api_secret_encrypted" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "api_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "open_time" DATETIME NOT NULL,
    "close_time" DATETIME,
    "avg_open_price" DECIMAL NOT NULL,
    "avg_close_price" DECIMAL,
    "quantity" DECIMAL NOT NULL,
    "max_quantity" DECIMAL NOT NULL,
    "max_position_value" DECIMAL NOT NULL,
    "max_margin" DECIMAL NOT NULL,
    "realized_pnl" DECIMAL NOT NULL,
    "fee" DECIMAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "position_id" TEXT,
    "user_id" TEXT NOT NULL,
    "binance_order_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "position_side" TEXT NOT NULL,
    "order_type" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "price" DECIMAL NOT NULL,
    "fee" DECIMAL NOT NULL,
    "realized_pnl" DECIMAL NOT NULL DEFAULT 0,
    "time" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trades_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL NOT NULL,
    "unrealized_pnl" DECIMAL NOT NULL,
    "total_equity" DECIMAL NOT NULL,
    "snapshot_time" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "positions_user_id_status_idx" ON "positions"("user_id", "status");

-- CreateIndex
CREATE INDEX "positions_symbol_idx" ON "positions"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "trades_binance_order_id_key" ON "trades"("binance_order_id");

-- CreateIndex
CREATE INDEX "trades_user_id_time_idx" ON "trades"("user_id", "time");

-- CreateIndex
CREATE INDEX "trades_symbol_idx" ON "trades"("symbol");

-- CreateIndex
CREATE INDEX "account_snapshots_user_id_snapshot_time_idx" ON "account_snapshots"("user_id", "snapshot_time");

-- CreateIndex
CREATE UNIQUE INDEX "account_snapshots_user_id_snapshot_time_key" ON "account_snapshots"("user_id", "snapshot_time");
