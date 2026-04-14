import { supabase } from '../db/supabase';
import { awardPoints } from './engine';

// Returns the new/current streak count after updating
export async function checkAndUpdateStreak(guildId: string, userId: string): Promise<number> {
  const today     = new Date().toISOString().split('T')[0]!;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;

  const { data } = await supabase
    .from('daily_streaks')
    .select('last_active_date, streak_count')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .single();

  if (!data) {
    // First ever activity
    await supabase.from('daily_streaks').insert({
      guild_id: guildId, user_id: userId,
      last_active_date: today, streak_count: 1,
    });
    await awardPoints(guildId, userId, 5, 'daily_streak_bonus');
    return 1;
  }

  if (data.last_active_date === today) return data.streak_count as number;

  const newStreak = data.last_active_date === yesterday ? (data.streak_count as number) + 1 : 1;

  await supabase.from('daily_streaks').update({
    last_active_date: today, streak_count: newStreak,
    updated_at: new Date().toISOString(),
  }).eq('guild_id', guildId).eq('user_id', userId);

  // Bonus: 5 base + (streak * 2) per day, capped at 30
  const bonus = Math.min(5 + newStreak * 2, 30);
  await awardPoints(guildId, userId, bonus, `daily_streak_${newStreak}`);

  return newStreak;
}

export async function getStreak(guildId: string, userId: string): Promise<number> {
  const { data } = await supabase
    .from('daily_streaks')
    .select('streak_count, last_active_date')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .single();

  if (!data) return 0;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;
  const today     = new Date().toISOString().split('T')[0]!;
  const isActive  = data.last_active_date === today || data.last_active_date === yesterday;
  return isActive ? (data.streak_count as number) : 0;
}
