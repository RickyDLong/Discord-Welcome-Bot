-- Archix Bot — Stats Schema
-- Run this in your Supabase SQL editor

-- ─────────────────────────────────────────
-- Member join / leave / role events
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_events (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  username    TEXT NOT NULL,
  event_type  TEXT NOT NULL, -- 'join' | 'leave' | 'role_add' | 'role_remove' | 'boost' | 'unboost'
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_member_events_guild_user ON member_events (guild_id, user_id);
CREATE INDEX idx_member_events_created_at ON member_events (created_at);

-- ─────────────────────────────────────────
-- Voice sessions (per continuous stay in a channel)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_sessions (
  id               BIGSERIAL PRIMARY KEY,
  guild_id         TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  channel_id       TEXT NOT NULL,
  channel_name     TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER  -- populated when session closes
);

CREATE INDEX idx_voice_sessions_guild_user    ON voice_sessions (guild_id, user_id);
CREATE INDEX idx_voice_sessions_channel       ON voice_sessions (channel_id);
CREATE INDEX idx_voice_sessions_started_at    ON voice_sessions (started_at);

-- ─────────────────────────────────────────
-- Voice state events (mute/unmute/deafen etc.)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_events (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  channel_id  TEXT,
  event_type  TEXT NOT NULL,
  -- 'join_channel' | 'leave_channel' | 'move_channel'
  -- 'mute' | 'unmute' | 'deafen' | 'undeafen'
  -- 'stream_start' | 'stream_stop' | 'video_start' | 'video_stop'
  -- 'server_mute' | 'server_unmute' | 'server_deafen' | 'server_undeafen'
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_events_guild_user   ON voice_events (guild_id, user_id);
CREATE INDEX idx_voice_events_created_at   ON voice_events (created_at);

-- ─────────────────────────────────────────
-- Message events
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_events (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  char_length INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_events_guild_user   ON message_events (guild_id, user_id);
CREATE INDEX idx_message_events_channel      ON message_events (channel_id);
CREATE INDEX idx_message_events_created_at   ON message_events (created_at);

-- ─────────────────────────────────────────
-- Reaction events
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reaction_events (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  event_type  TEXT NOT NULL, -- 'add' | 'remove'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reaction_events_guild_user  ON reaction_events (guild_id, user_id);
CREATE INDEX idx_reaction_events_created_at  ON reaction_events (created_at);

-- ─────────────────────────────────────────
-- Presence events (online/idle/dnd/offline)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS presence_events (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  status      TEXT NOT NULL, -- 'online' | 'idle' | 'dnd' | 'offline'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_presence_events_guild_user  ON presence_events (guild_id, user_id);
CREATE INDEX idx_presence_events_created_at  ON presence_events (created_at);

-- ─────────────────────────────────────────
-- Voice channel snapshots (live count history)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_channel_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  guild_id      TEXT NOT NULL,
  channel_id    TEXT NOT NULL,
  channel_name  TEXT,
  member_count  INTEGER NOT NULL,
  members       JSONB,  -- array of { user_id, username }
  snapshot_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_snapshots_channel     ON voice_channel_snapshots (channel_id);
CREATE INDEX idx_voice_snapshots_snapshot_at ON voice_channel_snapshots (snapshot_at);

-- ─────────────────────────────────────────
-- Useful views
-- ─────────────────────────────────────────

-- Today's voice leaderboard
CREATE OR REPLACE VIEW voice_leaderboard_today AS
SELECT
  user_id,
  SUM(duration_seconds) AS total_seconds
FROM voice_sessions
WHERE started_at >= CURRENT_DATE
  AND duration_seconds IS NOT NULL
GROUP BY user_id
ORDER BY total_seconds DESC;

-- Today's message leaderboard
CREATE OR REPLACE VIEW message_leaderboard_today AS
SELECT
  user_id,
  COUNT(*) AS message_count
FROM message_events
WHERE created_at >= CURRENT_DATE
GROUP BY user_id
ORDER BY message_count DESC;
