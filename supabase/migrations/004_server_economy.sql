-- ============================================================
-- 004: Server Economy (Coins)
-- ============================================================

-- ── Balances ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS server_economy (
  guild_id      TEXT    NOT NULL,
  user_id       TEXT    NOT NULL,
  balance       BIGINT  NOT NULL DEFAULT 0,
  total_earned  BIGINT  NOT NULL DEFAULT 0,
  total_spent   BIGINT  NOT NULL DEFAULT 0,
  last_daily    TIMESTAMPTZ,
  PRIMARY KEY (guild_id, user_id)
);

-- ── Transaction ledger ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS economy_transactions (
  id         BIGSERIAL   PRIMARY KEY,
  guild_id   TEXT        NOT NULL,
  user_id    TEXT        NOT NULL,
  amount     BIGINT      NOT NULL,  -- positive = earn, negative = spend
  reason     TEXT        NOT NULL,  -- daily | message | voice | quest | coinflip | slots | shop | gift_sent | gift_received
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economy_tx_guild_user ON economy_transactions (guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_economy_tx_created_at ON economy_transactions (created_at);

-- ── Shop items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id    TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  price       BIGINT      NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'cosmetic',  -- 'role' | 'cosmetic'
  role_id     TEXT,        -- Discord role ID to auto-assign (if type = 'role')
  stock       INTEGER,     -- NULL = unlimited
  enabled     BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, name)
);

-- ── Shop purchases ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_purchases (
  id           BIGSERIAL   PRIMARY KEY,
  guild_id     TEXT        NOT NULL,
  user_id      TEXT        NOT NULL,
  item_id      UUID        NOT NULL REFERENCES shop_items(id),
  price_paid   BIGINT      NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_purchases_guild_user ON shop_purchases (guild_id, user_id);

-- ── Atomic add coins (upsert balance + log transaction) ─────────────────
CREATE OR REPLACE FUNCTION economy_add_coins(
  p_guild_id TEXT,
  p_user_id  TEXT,
  p_amount   BIGINT,
  p_reason   TEXT,
  p_metadata JSONB DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_balance BIGINT;
BEGIN
  INSERT INTO server_economy (guild_id, user_id, balance, total_earned)
    VALUES (p_guild_id, p_user_id, p_amount, p_amount)
  ON CONFLICT (guild_id, user_id) DO UPDATE
    SET balance      = server_economy.balance + p_amount,
        total_earned = server_economy.total_earned + p_amount
  RETURNING balance INTO v_balance;

  INSERT INTO economy_transactions (guild_id, user_id, amount, reason, metadata)
    VALUES (p_guild_id, p_user_id, p_amount, p_reason, p_metadata);

  RETURN v_balance;
END;
$$;

-- ── Atomic deduct coins (raises if insufficient) ────────────────────────
CREATE OR REPLACE FUNCTION economy_deduct_coins(
  p_guild_id TEXT,
  p_user_id  TEXT,
  p_amount   BIGINT,
  p_reason   TEXT,
  p_metadata JSONB DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_balance BIGINT;
BEGIN
  UPDATE server_economy
    SET balance     = balance - p_amount,
        total_spent = total_spent + p_amount
  WHERE guild_id = p_guild_id AND user_id = p_user_id
    AND balance   >= p_amount
  RETURNING balance INTO v_balance;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO economy_transactions (guild_id, user_id, amount, reason, metadata)
    VALUES (p_guild_id, p_user_id, -p_amount, p_reason, p_metadata);

  RETURN v_balance;
END;
$$;
