import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { handleReady } from './events_v2/ready';
import { handleGuildMemberAdd } from './events_v2/guildMemberAdd';
import { handleGuildMemberRemove } from './events_v2/guildMemberRemove';
import { handleGuildMemberUpdate } from './events_v2/guildMemberUpdate';
import { handleVoiceStateUpdate } from './events_v2/voiceStateUpdate';
import { handleMessageCreate } from './events_v2/messageCreate';
import { handlePresenceUpdate } from './events_v2/presenceUpdate';
import { handleMessageReactionAdd } from './events_v2/messageReactionAdd';
import { handleMessageReactionRemove } from './events_v2/messageReactionRemove';
import { handleInteractionCreate } from './events_v2/interactionCreate';
import { startApiServer } from './api/server';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.GuildMember,
  ],
});

client.on('ready',               ()            => handleReady(client));
client.on('guildMemberAdd',      (member)      => handleGuildMemberAdd(member));
client.on('guildMemberRemove',   (member)      => handleGuildMemberRemove(member));
client.on('guildMemberUpdate',   (old, cur)    => handleGuildMemberUpdate(old, cur));
client.on('voiceStateUpdate',    (old, cur)    => handleVoiceStateUpdate(old, cur));
client.on('messageCreate',       (msg)         => handleMessageCreate(msg));
client.on('presenceUpdate',      (old, cur)    => handlePresenceUpdate(old, cur));
client.on('messageReactionAdd',  (rxn, user)   => handleMessageReactionAdd(rxn, user));
client.on('messageReactionRemove',(rxn, user)  => handleMessageReactionRemove(rxn, user));
client.on('interactionCreate',   (interaction) => handleInteractionCreate(interaction));

// Start Express API server for web dashboard
startApiServer();

client.login(config.BOT_TOKEN).catch(() => {
  console.error('Failed to authenticate bot. Check BOT_TOKEN.');
  process.exit(1);
});
