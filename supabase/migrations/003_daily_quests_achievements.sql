-- ============================================================
-- 003: Daily Quests + Achievements
-- ============================================================

-- Daily quest templates (the pool quests are drawn from)
CREATE TABLE IF NOT EXISTS daily_quest_templates (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL,
  quest_type  TEXT    NOT NULL,  -- 'messages' | 'voice_minutes' | 'reactions'
  target_value INTEGER NOT NULL,
  xp_reward   INTEGER NOT NULL,
  difficulty  TEXT    NOT NULL DEFAULT 'normal', -- 'easy' | 'normal' | 'hard'
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Daily quests generated each day (1 easy, 1 normal, 1 hard)
CREATE TABLE IF NOT EXISTS daily_quests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id     TEXT NOT NULL,
  template_id  UUID REFERENCES daily_quest_templates(id),
  quest_date   DATE NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  quest_type   TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  xp_reward    INTEGER NOT NULL,
  difficulty   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, quest_date, difficulty)
);

-- Per-user progress on each daily quest
CREATE TABLE IF NOT EXISTS daily_quest_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  quest_id     UUID REFERENCES daily_quests(id),
  quest_date   DATE NOT NULL,
  progress     INTEGER DEFAULT 0,
  completed    BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(guild_id, user_id, quest_id)
);

-- Achievement definitions (seeded below)
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  xp_reward   INTEGER NOT NULL DEFAULT 0,
  hidden      BOOLEAN DEFAULT false
);

-- Earned achievements per user
CREATE TABLE IF NOT EXISTS user_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id       TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  achievement_id TEXT REFERENCES achievement_definitions(id),
  earned_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, user_id, achievement_id)
);

-- ============================================================
-- Seed: Quest Templates
-- ============================================================
INSERT INTO daily_quest_templates (title, description, quest_type, target_value, xp_reward, difficulty) VALUES
  -- Easy
  ('Quick Chat',      'Send 5 messages today',                  'messages',      5,   25,  'easy'),
  ('Voice Check-In',  'Spend 10 minutes in a voice channel',    'voice_minutes', 10,  25,  'easy'),
  ('Spread the Love', 'React to 3 messages',                    'reactions',     3,   25,  'easy'),
  -- Normal
  ('Active Member',   'Send 20 messages today',                 'messages',      20,  75,  'normal'),
  ('Voice Regular',   'Spend 30 minutes in voice',              'voice_minutes', 30,  75,  'normal'),
  ('Reaction Machine','React to 10 messages',                   'reactions',     10,  60,  'normal'),
  -- Hard
  ('Chatterbox',      'Send 50 messages today',                 'messages',      50,  150, 'hard'),
  ('Voice Marathon',  'Spend 2 hours in a voice channel',       'voice_minutes', 120, 150, 'hard'),
  ('Super Reactor',   'React to 25 messages',                   'reactions',     25,  100, 'hard')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: Achievement Definitions
-- ============================================================
INSERT INTO achievement_definitions (id, name, description, emoji, xp_reward) VALUES
  -- Messages
  ('first_message',   'First Words',       'Send your first message',            '🗣️',  25),
  ('messages_100',    'Chatterbox',        'Send 100 messages',                  '💬',  50),
  ('messages_1000',   'Social Butterfly',  'Send 1,000 messages total',          '🦋',  200),
  ('messages_5000',   'Wordsmith',         'Send 5,000 messages total',          '✍️',  500),
  -- Voice
  ('voice_1h',        'Breaking the Ice',  'Spend 1 hour in voice',              '🎙️',  50),
  ('voice_10h',       'Regular',           'Spend 10 hours in voice total',      '🎧',  150),
  ('voice_50h',       'Voice Veteran',     'Spend 50 hours in voice total',      '📡',  400),
  ('voice_100h',      'Voice Addict',      'Spend 100 hours in voice total',     '📻',  750),
  -- Streaks
  ('streak_7',        'Week Warrior',      'Keep a 7-day streak',                '🔥',  100),
  ('streak_30',       'Grinder',           'Keep a 30-day streak',               '⚡',  500),
  ('streak_100',      'Unstoppable',       'Keep a 100-day streak',              '💪',  2000),
  -- Daily quests
  ('daily_quest_1',   'Daily Grind',       'Complete your first daily quest',    '🎯',  50),
  ('daily_quest_10',  'Quest Hunter',      'Complete 10 daily quests',           '🏹',  200),
  ('daily_quest_50',  'Quest Master',      'Complete 50 daily quests',           '⚔️',  750),
  ('daily_sweep',     'Triple Threat',     'Complete all 3 daily quests in one day', '🎰', 300),
  -- Tiers
  ('tier_active',     'Rising Star',       'Reach Active tier (100 XP)',         '🔵',  50),
  ('tier_regular',    'Regular',           'Reach Regular tier (500 XP)',        '🟢',  100),
  ('tier_veteran',    'Veteran',           'Reach Veteran tier (2,000 XP)',      '🟣',  250),
  ('tier_elite',      'Elite',             'Reach Elite tier (5,000 XP)',        '🟡',  500),
  ('tier_legend',     'Legend',            'Reach Legend tier (15,000 XP)',      '🔴',  2000),
  -- Special
  ('og_member',       'OG',                'One of the first 50 members',        '👑',  500)
ON CONFLICT DO NOTHING;
