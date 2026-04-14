import { Client } from 'discord.js';
import { registerSlashCommands } from '../commands/register';
import { startDashboardScheduler } from '../dashboard/scheduler';
import { startVoiceSnapshotScheduler } from '../points/voiceSnapshot';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
  console.log(`[Ready] Bot fully initialized. Serving ${client.guilds.cache.size} guild(s).`);
}
