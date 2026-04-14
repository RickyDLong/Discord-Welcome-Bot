import { Client } from 'discord.js';
import { updateDashboard } from './embed';

export function startDashboardScheduler(client: Client): void {
  // Initial update after 10s (give bot time to fully connect)
  setTimeout(() => updateDashboard(client), 10_000);
  // Then every 5 minutes
  setInterval(() => updateDashboard(client), 5 * 60 * 1000);
  console.log('📊 Dashboard scheduler started (every 5 min)');
}
