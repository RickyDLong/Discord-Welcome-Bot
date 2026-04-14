import { ChatInputCommandInteraction } from 'discord.js';
import { handlePointsCommand }      from '../commands/points';
import { handleLeaderboardCommand } from '../commands/leaderboard';
import { handleProfileCommand }     from '../commands/profile';
import { handleQuestCommand }       from '../commands/quest';
import { handleAdminCommand }       from '../commands/admin';

const commandMap: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
  points:      handlePointsCommand,
  leaderboard: handleLeaderboardCommand,
  profile:     handleProfileCommand,
  quest:       handleQuestCommand,
  admin:       handleAdminCommand,
};

export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const handler = commandMap[interaction.commandName];
  if (!handler) return;
  try {
    await handler(interaction);
  } catch (err) {
    console.error(`Command error [${interaction.commandName}]:`, err);
    const msg = { content: '❌ Something went wrong. Please try again.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.editReply(msg);
    else await interaction.reply(msg);
  }
}
