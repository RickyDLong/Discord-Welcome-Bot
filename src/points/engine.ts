import { supabase } from '../db/supabase';
import { checkTierProgression } from './tiers';

export async function awardPoints(
  userId: string, guildId: string, amount: number, reason: string,
): Promise<void> {
  if (amount <= 0) return;

  // Upsert user point balance
  const { data: existing } = await supabase
    .from('user_points')
    .select('points, total_earned')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  const currentPoints = existing?.points ?? 0;
  const totalEarned   = existing?.total_earned ?? 0;
  const newPoints     = currentPoints + amount;
  const newTotal      = totalEarned + amount;

  await supabase.from('user_points').upsert({
    user_id: userId, guild_id: guildId,
    points: newPoints, total_earned: newTotal,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,guild_id' });

  // Log the transaction
  await supabase.from('point_transactions').insert({
    guild_id: guildId, user_id: userId,
    amount, reason, balance_after: newPoints,
  });

  // Check if user has leveled up
  await checkTierProgression(userId, guildId, newTotal);
}

export async function deductPoints(
  userId: string, guildId: string, amount: number, reason: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('user_points')
    .select('points')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  const current = data?.points ?? 0;
  if (current < amount) return false;

  await supabase.from('user_points').update({
    points: current - amount, updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('guild_id', guildId);

  await supabase.from('point_transactions').insert({
    guild_id: guildId, user_id: userId,
    amount: -amount, reason, balance_after: current - amount,
  });

  return true;
}

export async function getUserPoints(userId: string, guildId: string): Promise<{ points: number; total_earned: number }> {
  const { data } = await supabase
    .from('user_points')
    .select('points, total_earned')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();
  return { points: data?.points ?? 0, total_earned: data?.total_earned ?? 0 };
}
