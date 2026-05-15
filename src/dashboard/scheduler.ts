import { Client } from 'discord.js';
import { updateDashboard } from './embed';
import { generateDailyQuests } from '../quests/dailyQuestEngine';

function allGuildIds(client: Client): string[] {
  return [...client.guilds.cache.keys()];
}

/** Generate quests for every guild the bot is in */
async function generateQuestsAllGuilds(client: Client): Promise<void> {
  for (const guildId of allGuildIds(client)) {
    await generateDailyQuests(guildId).catch(e =>
      console.error(`[Scheduler] Quest generation failed for ${guildId}:`, e),
    );
  }
}

/** Schedule daily quest generation at the next UTC midnight, then every 24h */
function scheduleMidnightQuests(client: Client): void {
  const now = new Date();
  const nextMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  const msUntilMidnight = nextMidnight.getTime() - Date.now();

  console.log(`📋 Daily quests will regenerate in ${Math.round(msUntilMidnight / 60000)} min (next UTC midnight)`);

  setTimeout(() => {
    generateQuestsAllGuilds(client).catch(console.error);
    setInterval(() => generateQuestsAllGuilds(client).catch(console.error), 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

export function startDashboardScheduler(client: Client): void {
  // Generate today's quests on startup for every guild (idempotent — skips if already done)
  generateQuestsAllGuilds(client).catch(console.error);

  // Schedule midnight refresh
  scheduleMidnightQuests(client);

  // Initial dashboard update after 10s (give bot time to fully connect)
  setTimeout(() => updateDashboard(client), 10_000);
  // Then every 5 minutes
  setInterval(() => updateDashboard(client), 5 * 60 * 1000);

  console.log('📊 Dashboard scheduler started (every 5 min)');
}
