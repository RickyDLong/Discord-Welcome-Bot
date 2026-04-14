import { Client } from 'discord.js';
import { registerSlashCommands } from '../commands/register';
import { startDashboardScheduler } from '../dashboard/scheduler';
import { startVoiceSnapshotScheduler } from '../points/voiceSnapshot';

export async function handleReady(client: Client) {
  console.log(`[Ready] Logged in as ${client.user?.tag}`);
  try {
    await registerSlashCommands(client);
    console.log('[Ready] Slash commands registered');
  } catch (e) {
    console.error('[Ready] Failed to register commands:', e);
  }
  startDashboardScheduler(client);
  startVoiceSnapshotScheduler(client);
  console.log(`[Ready] Bot fully initialized. Serving ${client.guilds.cache.size} guild(s).`);
}
