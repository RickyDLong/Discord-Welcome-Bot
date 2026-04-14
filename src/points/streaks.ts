import { supabase } from '../db/supabase';
import { awardPoints } from './engine';

export async function checkAndUpdateStreak(userId: string, guildId: string): Promise<void> {
  const today     = new Date().toISOString().split('T')[0]!;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;

  const { data } = await supabase
    .from('daily_streaks')
    .select('last_active_date, streak_count')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  if (!data) {
    // First ever activity
    await supabase.from('daily_streaks').insert({
      user_id: userId, guild_id: guildId,
      last_active_date: today, streak_count: 1,
    });
    await awardPoints(userId, guildId, 5, 'daily_streak_bonus');
    return;
  }

  if (data.last_active_date === today) return; // Already active today

  const newStreak = data.last_active_date === yesterday ? data.streak_count + 1 : 1;

  await supabase.from('daily_streaks').update({
    last_active_date: today, streak_count: newStreak,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('guild_id', guildId);

  // Bonus: 5 base + (streak * 2) per day, capped at 30
  const bonus = Math.min(5 + newStreak * 2, 30);
  await awardPoints(userId, guildId, bonus, `daily_streak_${newStreak}`);
}

export async function getStreak(userId: string, guildId: string): Promise<number> {
  const { data } = await supabase
    .from('daily_streaks')
    .select('streak_count, last_active_date')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  if (!data) return 0;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;
  const today     = new Date().toISOString().split('T')[0]!;
  const isActive  = data.last_active_date === today || data.last_active_date === yesterday;
  return isActive ? data.streak_count : 0;
}
