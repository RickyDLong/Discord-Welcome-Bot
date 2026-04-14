import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserAchievements } from '../achievements/engine';

export async function handleAchievementsCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId!;
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const userId = targetUser.id;

  const achievements = await getUserAchievements(guildId, userId);

  const embed = new EmbedBuilder().setTimestamp();

  if (achievements.length === 0) {
    embed
      .setColor(0x6b7280)
      .setTitle(`🏆  ${targetUser.username}'s Achievements`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        'No achievements earned yet.\nStart chatting, hop in voice, and complete daily quests to unlock badges.',
      );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const totalXp = achievements.reduce((sum, a) => {
    const def = a.achievement_definitions as Record<string, any> | null;
    return sum + ((def?.xp_reward as number) ?? 0);
  }, 0);

  // Show up to 15 — Discord embed has a 25-field limit and inline fields look better in groups of 2
  const shown = achievements.slice(0, 15);
  const fields = shown.map(a => {
    const def = a.achievement_definitions as Record<string, any> | null;
    const date = new Date(a.earned_at as string).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    return {
      name: `${(def?.emoji as string) ?? '🏅'}  ${(def?.name as string) ?? a.achievement_id}`,
      value: `${(def?.description as string) ?? ''}\n💎 +${(def?.xp_reward as number) ?? 0} XP  ·  *${date}*`,
      inline: true,
    };
  });

  embed
    .setColor(0xf59e0b)
    .setTitle(`🏆  ${targetUser.username}'s Achievements`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setDescription(
      `**${achievements.length}** achievement${achievements.length !== 1 ? 's' : ''} unlocked  ·  **${totalXp} bonus XP** from badges`,
    )
    .addFields(...fields)
    .setFooter({
      text: achievements.length > 15
        ? `Showing 15 of ${achievements.length}  ·  Archix Digital`
        : 'Archix Digital',
    });

  await interaction.editReply({ embeds: [embed] });
}
