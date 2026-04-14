import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { handleReady } from './events/ready';
import { handleGuildMemberAdd } from './events/guildMemberAdd';
import { handleInteractionCreate } from './events/interactionCreate';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('ready', () => handleReady(client));
client.on('guildMemberAdd', handleGuildMemberAdd);
client.on('interactionCreate', handleInteractionCreate);

client.login(config.token).catch((err) => {
  console.error('Failed to login:', err);
  process.exit(1);
});
