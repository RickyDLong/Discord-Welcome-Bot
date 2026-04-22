import { Client, EmbedBuilder } from 'discord.js';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';
import { checkQuestAchievements, checkAndAwardAchievement } from '../achievements/engine';
import { addCoins, COINS_PER_QUEST } from '../economy/engine';

// ── Generate today's 3 quests (1 easy, 1 normal, 1 hard) ──────────────────
export async function generateDailyQuests(guildId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!;

  const { data: existing } = await supabase
    .from('daily_quests')
    .select('id')
    .eq('guild_id', guildId)
    .eq('quest_date', today)
    .limit(1);

  if (existing && existing.length > 0) return; // Already generated

  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const { data: templates } = await supabase
      .from('daily_quest_templates')
      .select('*')
      .eq('difficulty', difficulty)
      .eq('active', true);

    if (!templates || templates.length === 0) continue;
    const template = templates[Math.floor(Math.random() * templates.length)]!;

    await supabase.from('daily_quests').insert({
      guild_id:     guildId,
      template_id:  template.id,
      quest_date:   today,
      title:        template.title,
      description:  template.description,
      quest_type:   template.quest_type,
      target_value: template.target_value,
      xp_reward:    template.xp_reward,
      difficulty:   template.difficulty,
    });
  }

  console.log(`[DailyQuests] Generated quests for ${guildId} on ${today}`);
}

// ── Fetch today's quests for a guild ──────────────────────────────────────
export async function getTodayQuests(guildId: string) {
  const today = new Date().toISOString().split('T')[0]!;
  const { data } = await supabase
    .from('daily_quests')
    .select('*')
    .eq('guild_id', guildId)
    .eq('quest_date', today)
    .order('difficulty');
  return data ?? [];
}

// ── Fetch a user's progress on a list of quest IDs ────────────────────────
export async function getUserQuestProgress(
  guildId: string,
  userId: string,
  questIds: string[],
) {
  if (questIds.length === 0) return [];
  const { data } = await supabase
    .from('daily_quest_progress')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .in('quest_id', questIds);
  return data ?? [];
}

// ── Update progress for a quest type (called from event handlers) ──────────
export async function updateQuestProgress(
  guildId: string,
  userId: string,
  questType: string,
  amount: number,
  client: Client,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!;

  const { data: quests } = await supabase
    .from('daily_quests')
    .select('*')
    .eq('guild_id', guildId)
    .eq('quest_date', today)
    .eq('quest_type', questType);

  if (!quests || quests.length === 0) return;

  for (const quest of quests) {
    const { data: prog } = await supabase
      .from('daily_quest_progress')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('quest_id', quest.id)
      .maybeSingle();

    if (prog?.completed) continue;

    const current = prog?.progress ?? 0;
    const newProgress = Math.min(current + amount, quest.target_value);
    const completed = newProgress >= quest.target_value;

    await supabase.from('daily_quest_progress').upsert({
      guild_id:     guildId,
      user_id:      userId,
      quest_id:     quest.id,
      quest_date:   today,
      progress:     newProgress,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    }, { onConflict: 'guild_id,user_id,quest_id' });

    if (completed && !prog?.completed) {
      await onQuestComplete(guildId, userId, quest, client);
    }
  }
}

// ── Handle quest completion ────────────────────────────────────────────────
async function onQuestComplete(
  guildId: string,
  userId: string,
  quest: Record<string, any>,
  client: Client,
): Promise<void> {
  await awardPoints(guildId, userId, quest.xp_reward, `daily_quest_${quest.id}`);

  // Economy: bonus coins based on quest difficulty
  const coinReward = COINS_PER_QUEST[quest.difficulty as string] ?? COINS_PER_QUEST['normal']!;
  void addCoins(guildId, userId, coinReward, 'quest', { quest_id: quest.id, difficulty: quest.difficulty });

  await checkQuestAchievements(guildId, userId, client);

  // Check triple threat (all 3 done today)
  const today = new Date().toISOString().split('T')[0]!;
  const { data: todayQuests } = await supabase
    .from('daily_quests')
    .select('id')
    .eq('guild_id', guildId)
    .eq('quest_date', today);

  if (todayQuests && todayQuests.length === 3) {
    const ids = todayQuests.map(q => q.id);
    const { count } = await supabase
      .from('daily_quest_progress')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .in('quest_id', ids)
      .eq('completed', true);

    if ((count ?? 0) >= 3) {
      await checkAndAwardAchievement(guildId, userId, 'daily_sweep', client);
    }
  }

  // DM the user
  try {
    const user = await client.users.fetch(userId);
    const diffEmoji: Record<string, string> = { easy: '🟢', normal: '🟡', hard: '🔴' };
    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('✅  Daily Quest Complete!')
      .setDescription(`**${quest.title}**\n${quest.description}`)
      .addFields(
        { name: '💎 XP Earned', value: `+${quest.xp_reward} XP`, inline: true },
        {
          name: '📊 Difficulty',
          value: `${diffEmoji[quest.difficulty] ?? '⚡'} ${(quest.difficulty as string).charAt(0).toUpperCase() + (quest.difficulty as string).slice(1)}`,
          inline: true,
        },
      )
      .setFooter({ text: 'Use /daily to track all quests' })
      .setTimestamp();
    await user.send({ embeds: [embed] }).catch(() => {});
  } catch { /* silent */ }

  console.log(`[DailyQuests] ${userId} completed "${quest.title}" (+${quest.xp_reward} XP)`);
}
