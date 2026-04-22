import { ChatInputCommandInteraction } from 'discord.js';
import { handlePointsCommand }        from '../commands/points';
import { handleLeaderboardCommand }   from '../commands/leaderboard';
import { handleProfileCommand }       from '../commands/profile';
import { handleQuestCommand }         from '../commands/quest';
import { handleAdminCommand }         from '../commands/admin';
import { handleDailyCommand }         from '../commands/daily';
import { handleAchievementsCommand }  from '../commands/achievements';
import {
  handleBalance, handleDaily as handleClaim, handleGive,
  handleCoinflip, handleSlots, handleRichest,
  handleShop, handleBuy, handleAddItem, handleRemoveItem,
} from '../commands/economy';

const commandMap: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
  // Existing
  points:       handlePointsCommand,
  leaderboard:  handleLeaderboardCommand,
  profile:      handleProfileCommand,
  quest:        handleQuestCommand,
  admin:        handleAdminCommand,
  daily:        handleDailyCommand,
  achievements: handleAchievementsCommand,
  // Economy
  balance:      handleBalance,
  claim:        handleClaim,
  give:         handleGive,
  coinflip:     handleCoinflip,
  slots:        handleSlots,
  richest:      handleRichest,
  shop:         handleShop,
  buy:          handleBuy,
  additem:      handleAddItem,
  removeitem:   handleRemoveItem,
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
