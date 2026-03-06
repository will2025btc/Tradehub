-- Migration: Add AI Config and Daily Review tables
-- Adds user-configurable AI model settings and daily review storage

-- 1. 创建 ai_configs_review 表（用户自己的 AI 模型配置）
CREATE TABLE IF NOT EXISTS "ai_configs_review" (
    "id"                TEXT        NOT NULL,
    "user_id"           TEXT        NOT NULL,
    "provider"          TEXT        NOT NULL DEFAULT 'anthropic',
    "model"             TEXT        NOT NULL DEFAULT 'claude-opus-4-6',
    "api_key_encrypted" TEXT        NOT NULL,
    "base_url"          TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_configs_review_pkey" PRIMARY KEY ("id")
);

-- 2. 创建 daily_reviews 表（每日复盘记录）
CREATE TABLE IF NOT EXISTS "daily_reviews" (
    "id"         TEXT         NOT NULL,
    "user_id"    TEXT         NOT NULL,
    "date"       TEXT         NOT NULL,
    "ai_review"  TEXT         NOT NULL,
    "pos_count"  INTEGER      NOT NULL DEFAULT 0,
    "total_pnl"  DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_reviews_pkey" PRIMARY KEY ("id")
);

-- 3. 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS "ai_configs_review_user_id_key"
    ON "ai_configs_review"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "daily_reviews_user_id_date_key"
    ON "daily_reviews"("user_id", "date");

CREATE INDEX IF NOT EXISTS "daily_reviews_user_id_date_idx"
    ON "daily_reviews"("user_id", "date");

-- 4. 外键约束
ALTER TABLE "ai_configs_review"
    ADD CONSTRAINT "ai_configs_review_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_reviews"
    ADD CONSTRAINT "daily_reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
