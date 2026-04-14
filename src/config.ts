import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  // Discord
  BOT_TOKEN:             required('BOT_TOKEN'),
  GUILD_ID:              required('GUILD_ID'),
  WELCOME_CHANNEL_ID:    required('WELCOME_CHANNEL_ID'),
  STATS_CHANNEL_ID:      required('STATS_CHANNEL_ID'),
  ROLE_COMMUNITY_MEMBER: required('ROLE_COMMUNITY_MEMBER'),
  ROLE_BUILDER:          required('ROLE_BUILDER'),
  ROLE_GAMER:            required('ROLE_GAMER'),

  // Supabase
  SUPABASE_URL:          required('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY:  required('SUPABASE_SERVICE_KEY'),

  // API
  PORT: parseInt(process.env['PORT'] ?? '3000', 10),
};
