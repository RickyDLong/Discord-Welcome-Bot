-- ── 005_buffs_and_shop.sql ───────────────────────────────────────────────────
-- User buff/boost tracking + shop_items column extension + default shop seed

-- Add buff duration column to shop_items (NULL = one-shot/permanent)
ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS buff_duration_hours INTEGER;

-- Active user buffs table
CREATE TABLE IF NOT EXISTS user_buffs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  guild_id      TEXT        NOT NULL,
  user_id       TEXT        NOT NULL,
  buff_type     TEXT        NOT NULL,
  multiplier    NUMERIC     DEFAULT 2,
  expires_at    TIMESTAMPTZ,             -- NULL means one-shot (no time limit)
  used          BOOLEAN     DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_buffs_active
  ON user_buffs(guild_id, user_id, buff_type)
  WHERE used = false;

-- Seed default shop items for guild 248171801887244289
-- Buff items (fully automated)
INSERT INTO shop_items (guild_id, name, description, price, type, stock, buff_duration_hours) VALUES
  ('248171801887244289',
   'XP Surge',
   '⚡ Double your XP earnings for the next 24 hours. Stack your activity and climb fast.',
   800, 'xp_boost', -1, 24),

  ('248171801887244289',
   'Coin Magnet',
   '💬 Earn 2x coins from every message for 24 hours. Talk your way to the top.',
   500, 'coin_boost_msg', -1, 24),

  ('248171801887244289',
   'Voice Bonus',
   '🎙️ Earn 2x coins from voice time for 24 hours. Hang out and get paid.',
   500, 'coin_boost_voice', -1, 24),

  ('248171801887244289',
   'Daily Double',
   '🌟 Your next /claim pays out 200 coins instead of 100. One-time use.',
   350, 'daily_double', -1, NULL),

  ('248171801887244289',
   'Lucky Charm',
   '🍀 Guarantee a win on your next /coinflip — no matter what the flip lands. One-time use.',
   300, 'lucky_charm', -1, NULL),

  ('248171801887244289',
   'House Edge',
   '🎲 Lost a coinflip? Activate this for a free reroll on your next loss. One-time use.',
   400, 'house_edge', -1, NULL),

  ('248171801887244289',
   'Quest Reroll',
   '🔄 Swap one of today''s daily quests for a fresh one. Pick easy, normal, or hard. One-time use.',
   200, 'quest_reroll', -1, NULL)

ON CONFLICT (guild_id, name) DO NOTHING;
