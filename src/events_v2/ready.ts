import { Client } from 'discord.js';
import { registerSlashCommands } from '../commands/register';
import { startDashboardScheduler } from '../dashboard/scheduler';
import { startVoiceSnapshotScheduler } from '../points/voiceSnapshot';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { supabase } from '../db/supabase';
import { config } from '../config';

async function seedMemberProfiles(client: Client): Promise<void> {
  try {
    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild) return;
    const members = await guild.members.fetch();
    const rows = members
      .filter(m => !m.user.bot)
      .map(m => ({
        guild_id:     guild.id,
        user_id:      m.id,
        username:     m.user.username,
        display_name: m.displayName,
        avatar_hash:  m.user.avatar,
        updated_at:   new Date().toISOString(),
      }));
    // Upsert in batches of 100 to avoid payload limits
    for (let i = 0; i < rows.length; i += 100) {
      await supabase.from('user_profiles').upsert(rows.slice(i, i + 100), { onConflict: 'guild_id,user_id' });
    }
    console.log(`[Ready] Seeded profiles for ${rows.length} member(s).`);
  } catch (e) {
    console.warn('[Ready] Profile seed failed:', (e as Error).message);
  }
}

export async function handleReady(client: Client) {
  console.log(`[Ready] Logged in as ${client.user?.tag}`);
  try {
    await registerSlashCommands(client);
    console.log('[Ready] Slash commands registered');
  } catch (e) {
    console.error('[Ready] Failed to register commands:', e);
  }

  // Set bot avatar from local file (only if archix-icon.png exists — skips silently otherwise)
  try {
    const iconPath = join(process.cwd(), 'archix-icon.png');
    if (existsSync(iconPath)) {
      await client.user?.setAvatar(readFileSync(iconPath));
      console.log('[Ready] Bot avatar updated from archix-icon.png');
    }
  } catch (e) {
    // Avatar rate-limited or already set — not fatal
    console.warn('[Ready] Could not update avatar:', (e as Error).message);
  }

  startDashboardScheduler(client);
  startVoiceSnapshotScheduler(client);

  // Bulk-seed user_profiles for all guild members so leaderboards always show names
  void seedMemberProfiles(client);

  console.log(`[Ready] Bot fully initialized. Serving ${client.guilds.cache.size} guild(s).`);
}
