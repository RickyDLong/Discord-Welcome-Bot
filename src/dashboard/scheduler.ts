import { Client } from 'discord.js';
import { updateDashboard } from './embed';
import { generateDailyQuests } from '../quests/dailyQuestEngine';
import { config } from '../config';

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
    generateDailyQuests(config.GUILD_ID).catch(console.error);
    // Then repeat every 24h
    setInterval(() => {
      generateDailyQuests(config.GUILD_ID).catch(console.error);
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

export function startDashboardScheduler(client: Client): void {
  // Generate today's quests immediately on startup (idempotent — skips if already done)
  generateDailyQuests(config.GUILD_ID).catch(console.error);

  // Schedule midnight refresh
  scheduleMidnightQuests(client);

  // Initial dashboard update after 10s (give bot time to fully connect)
  setTimeout(() => updateDashboard(client), 10_000);
  // Then every 5 minutes
  setInterval(() => updateDashboard(client), 5 * 60 * 1000);

  console.log('📊 Dashboard scheduler started (every 5 min)');
}
