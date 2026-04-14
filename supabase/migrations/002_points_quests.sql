-- Points economy
CREATE TABLE IF NOT EXISTS user_points (
  id            BIGSERIAL PRIMARY KEY,
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  username      TEXT NOT NULL DEFAULT '',
  total_points  INTEGER NOT NULL DEFAULT 0,
  total_earned  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  reason      TEXT NOT NULL,  -- 'message','voice_time','join_bonus','reaction_received','quest','manual','server_boost','streak_bonus'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tier system
CREATE TABLE IF NOT EXISTS user_tiers (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  tier_name   TEXT NOT NULL DEFAULT 'Member',
  tier_level  INTEGER NOT NULL DEFAULT 0,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);

-- Daily streaks
CREATE TABLE IF NOT EXISTS daily_streaks (
  id              BIGSERIAL PRIMARY KEY,
  guild_id        TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);

-- Quests
CREATE TABLE IF NOT EXISTS quests (
  id            BIGSERIAL PRIMARY KEY,
  guild_id      TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 50,
  quest_type    TEXT NOT NULL DEFAULT 'manual',  -- 'manual','auto_voice','auto_message'
  target_value  INTEGER,                          -- for auto quests: threshold
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quest_submissions (
  id          BIGSERIAL PRIMARY KEY,
  quest_id    BIGINT NOT NULL REFERENCES quests(id),
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  username    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending','approved','rejected'
  proof_text  TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_points_guild_total ON user_points(guild_id, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_guild_user ON point_transactions(guild_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_streaks_guild_streak ON daily_streaks(guild_id, current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_quest_submissions_guild_status ON quest_submissions(guild_id, status);

-- Leaderboard views
CREATE OR REPLACE VIEW points_leaderboard AS
SELECT
  guild_id,
  user_id,
  username,
  total_points,
  total_earned,
  RANK() OVER (PARTITION BY guild_id ORDER BY total_points DESC) AS rank
FROM user_points;

CREATE OR REPLACE VIEW streak_leaderboard AS
SELECT
  guild_id,
  user_id,
  current_streak,
  longest_streak,
  RANK() OVER (PARTITION BY guild_id ORDER BY current_streak DESC) AS rank
FROM daily_streaks;
