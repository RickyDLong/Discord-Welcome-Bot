import { Client } from 'discord.js';

export function handleReady(client: Client): void {
  console.log(`✅ ${client.user?.tag} is online — watching for new members.`);
}
