/**
 * Per-guild configuration for features that need server-specific channel/role IDs.
 * The primary guild (Archix) is configured via .env — add additional guilds here.
 */

export interface GuildConfig {
  guildId: string;
  name: string;
  statsChannelId: string;        // Channel where the live stats embed posts
  welcomeChannelId?: string;     // Override welcome channel (falls back to system channel if omitted)
  communityRoleId?: string;      // Role assigned on join (omit if not applicable)
}

export const GUILD_CONFIGS: Record<string, GuildConfig> = {
  // Abain's Discord
  '692162728424505376': {
    guildId:        '692162728424505376',
    name:           "Abain's Discord",
    statsChannelId: '1504925858979123311',
  },
};
