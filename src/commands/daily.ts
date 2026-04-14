import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { generateDailyQuests, getTodayQuests, getUserQuestProgress } from '../quests/dailyQuestEngine';

function progressBar(current: number, target: number, length = 12): string {
  const pct = Math.min(current / target, 1);
  const filled = Math.round(pct * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export async function handleDailyCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Ensure today's quests exist
  await generateDailyQuests(guildId);

  const quests = await getTodayQuests(guildId);
  if (quests.length === 0) {
    await interaction.editReply({ content: '❌ No quests available yet — try again in a moment.' });
    return;
  }

  const questIds = quests.map(q => q.id as string);
  const progress = await getUserQuestProgress(guildId, userId, questIds);
  const progMap = new Map(progress.map(p => [p.quest_id as string, p]));

  const diffEmoji: Record<string, string> = { easy: '🟢', normal: '🟡', hard: '🔴' };
  const completedCount = progress.filter(p => p.completed).length;
  const xpEarned = quests
    .filter(q => progMap.get(q.id as string)?.completed)
    .reduce((sum, q) => sum + (q.xp_reward as number), 0);
  const totalXp = quests.reduce((sum, q) => sum + (q.xp_reward as number), 0);

  const fields = quests.map(q => {
    const prog = progMap.get(q.id as string);
    const current = (prog?.progress as number) ?? 0;
    const completed = (prog?.completed as boolean) ?? false;
    const bar = progressBar(current, q.target_value as number);
    const status = completed ? '✅' : '⏳';
    return {
      name: `${diffEmoji[q.difficulty as string] ?? '⚡'}  ${q.title as string}  ${status}`,
      value: `${q.description as string}\n\`${bar}\`  ${current} / ${q.target_value}\n💎 **${q.xp_reward} XP**`,
      inline: false,
    };
  });

  const allDone = completedCount === 3;

  const embed = new EmbedBuilder()
    .setColor(allDone ? 0xf59e0b : 0x7c3aed)
    .setTitle('📋  Daily Quests')
    .setDescription(
      allDone
        ? '🎰 **Triple Threat!** You crushed all 3 quests today. Fresh set drops at midnight UTC.'
        : `Complete all 3 for the **Triple Threat** bonus (+300 XP)\n**${completedCount} / 3 completed**`,
    )
    .addFields(...fields)
    .addFields({
      name: '💰 XP Earned Today',
      value: `**${xpEarned}** / ${totalXp} XP`,
      inline: false,
    })
    .setFooter({ text: 'Quests reset at midnight UTC  ·  Archix Digital' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
