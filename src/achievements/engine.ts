import { Client, EmbedBuilder } from 'discord.js';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';

// ── Award an achievement if not already earned ─────────────────────────────
export async function checkAndAwardAchievement(
  guildId: string,
  userId: string,
  achievementId: string,
  client?: Client,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('achievement_id', achievementId)
    .maybeSingle();

  if (existing) return false;

  const { data: def } = await supabase
    .from('achievement_definitions')
    .select('*')
    .eq('id', achievementId)
    .maybeSingle();

  if (!def) return false;

  await supabase.from('user_achievements').insert({
    guild_id: guildId,
    user_id: userId,
    achievement_id: achievementId,
  });

  if (def.xp_reward > 0) {
    await awardPoints(guildId, userId, def.xp_reward, `achievement_${achievementId}`);
  }

  if (client) {
    try {
      const user = await client.users.fetch(userId);
      const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`${def.emoji}  Achievement Unlocked!`)
        .setDescription(`**${def.name}**\n${def.description}`)
        .addFields({ name: '💎 XP Reward', value: `+${def.xp_reward} XP`, inline: true })
        .setFooter({ text: 'Archix Digital' })
        .setTimestamp();
      await user.send({ embeds: [embed] }).catch(() => {});
    } catch { /* DMs closed */ }
  }

  console.log(`[Achievement] ${userId} earned "${achievementId}"`);
  return true;
}

// ── Message milestones ─────────────────────────────────────────────────────
export async function checkMessageAchievements(
  guildId: string,
  userId: string,
  client: Client,
): Promise<void> {
  const { count } = await supabase
    .from('message_events')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  const n = count ?? 0;
  if (n >= 1)    await checkAndAwardAchievement(guildId, userId, 'first_message', client);
  if (n >= 100)  await checkAndAwardAchievement(guildId, userId, 'messages_100', client);
  if (n >= 1000) await checkAndAwardAchievement(guildId, userId, 'messages_1000', client);
  if (n >= 5000) await checkAndAwardAchievement(guildId, userId, 'messages_5000', client);
}

// ── Voice time milestones ──────────────────────────────────────────────────
export async function checkVoiceAchievements(
  guildId: string,
  userId: string,
  client: Client,
): Promise<void> {
  const { data } = await supabase
    .from('voice_sessions')
    .select('duration_seconds')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .not('duration_seconds', 'is', null);

  const totalHours = (data ?? []).reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 3600;
  if (totalHours >= 1)   await checkAndAwardAchievement(guildId, userId, 'voice_1h', client);
  if (totalHours >= 10)  await checkAndAwardAchievement(guildId, userId, 'voice_10h', client);
  if (totalHours >= 50)  await checkAndAwardAchievement(guildId, userId, 'voice_50h', client);
  if (totalHours >= 100) await checkAndAwardAchievement(guildId, userId, 'voice_100h', client);
}

// ── Streak milestones ──────────────────────────────────────────────────────
export async function checkStreakAchievements(
  guildId: string,
  userId: string,
  streakCount: number,
  client: Client,
): Promise<void> {
  if (streakCount >= 7)   await checkAndAwardAchievement(guildId, userId, 'streak_7', client);
  if (streakCount >= 30)  await checkAndAwardAchievement(guildId, userId, 'streak_30', client);
  if (streakCount >= 100) await checkAndAwardAchievement(guildId, userId, 'streak_100', client);
}

// ── Tier milestones ────────────────────────────────────────────────────────
export async function checkTierAchievement(
  guildId: string,
  userId: string,
  tierName: string,
  client: Client,
): Promise<void> {
  const map: Record<string, string> = {
    Active: 'tier_active', Regular: 'tier_regular',
    Veteran: 'tier_veteran', Elite: 'tier_elite', Legend: 'tier_legend',
  };
  const id = map[tierName];
  if (id) await checkAndAwardAchievement(guildId, userId, id, client);
}

// ── Quest milestones ───────────────────────────────────────────────────────
export async function checkQuestAchievements(
  guildId: string,
  userId: string,
  client: Client,
): Promise<void> {
  const { count } = await supabase
    .from('daily_quest_progress')
    .select('*', { count: 'exact', head: true })
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('completed', true);

  const n = count ?? 0;
  if (n >= 1)  await checkAndAwardAchievement(guildId, userId, 'daily_quest_1', client);
  if (n >= 10) await checkAndAwardAchievement(guildId, userId, 'daily_quest_10', client);
  if (n >= 50) await checkAndAwardAchievement(guildId, userId, 'daily_quest_50', client);
}

// ── Read user achievements ─────────────────────────────────────────────────
export async function getUserAchievements(guildId: string, userId: string) {
  const { data } = await supabase
    .from('user_achievements')
    .select('achievement_id, earned_at, achievement_definitions(name, description, emoji, xp_reward)')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  return data ?? [];
}
