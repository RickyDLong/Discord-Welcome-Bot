import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserPoints } from '../points/engine';
import { getStreak } from '../points/streaks';
import { getTierForPoints } from '../points/tiers';

export async function handlePointsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const { points, total_earned } = await getUserPoints(interaction.user.id, interaction.guildId!);
  const streak  = await getStreak(interaction.user.id, interaction.guildId!);
  const tier    = getTierForPoints(total_earned);
  const next    = [...require('../points/tiers').TIERS].find((t: any) => t.minPoints > total_earned);
  const toNext  = next ? next.minPoints - total_earned : 0;

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(`${tier.emoji} ${interaction.user.username}'s Points`)
    .addFields(
      { name: '💎 Points',     value: `**${points.toLocaleString()}**`,       inline: true },
      { name: '📊 Total Earned', value: `**${total_earned.toLocaleString()}**`, inline: true },
      { name: '🔥 Streak',     value: `**${streak} days**`,                  inline: true },
      { name: '🏆 Tier',       value: `**${tier.name}**`,                    inline: true },
      ...(next ? [{ name: '⬆️ Next Tier', value: `**${toNext.toLocaleString()}** pts to ${next.name}`, inline: true }] : []),
    )
    .setFooter({ text: 'Earn points by chatting, being in voice, and completing quests!' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
