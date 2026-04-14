import 'dotenv/config';

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  token: require_env('BOT_TOKEN'),
  guildId: require_env('GUILD_ID'),
  welcomeChannelId: require_env('WELCOME_CHANNEL_ID'),
  roles: {
    communityMember: require_env('ROLE_COMMUNITY_MEMBER'),
    builder: require_env('ROLE_BUILDER'),
    gamer: require_env('ROLE_GAMER'),
  },
} as const;
