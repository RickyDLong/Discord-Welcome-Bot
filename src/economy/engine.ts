import { supabase } from '../db/supabase';

export interface Balance {
  balance:      number;
  total_earned: number;
  total_spent:  number;
  last_daily:   string | null;
}

// ── Get or initialise a user's balance row ────────────────────────────────
export async function getBalance(guildId: string, userId: string): Promise<Balance> {
  const { data } = await supabase
    .from('server_economy')
    .select('balance, total_earned, total_spent, last_daily')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();

  return data ?? { balance: 0, total_earned: 0, total_spent: 0, last_daily: null };
}

// ── Add coins to a user (earn) ────────────────────────────────────────────
export async function addCoins(
  guildId:  string,
  userId:   string,
  amount:   number,
  reason:   string,
  metadata?: Record<string, unknown>,
): Promise<number> {
  if (amount <= 0) throw new Error('amount must be positive');

  const { data, error } = await supabase.rpc('economy_add_coins', {
    p_guild_id: guildId,
    p_user_id:  userId,
    p_amount:   amount,
    p_reason:   reason,
    p_metadata: metadata ?? null,
  });

  if (error) throw error;
  return (data as number);
}

// ── Deduct coins from a user (spend) — throws if insufficient ─────────────
export async function deductCoins(
  guildId:  string,
  userId:   string,
  amount:   number,
  reason:   string,
  metadata?: Record<string, unknown>,
): Promise<number> {
  if (amount <= 0) throw new Error('amount must be positive');

  const { data, error } = await supabase.rpc('economy_deduct_coins', {
    p_guild_id: guildId,
    p_user_id:  userId,
    p_amount:   amount,
    p_reason:   reason,
    p_metadata: metadata ?? null,
  });

  if (error) {
    if (error.message?.includes('Insufficient')) throw new Error('Insufficient balance');
    throw error;
  }
  return (data as number);
}

// ── Transfer coins between users ──────────────────────────────────────────
export async function transferCoins(
  guildId:    string,
  fromUserId: string,
  toUserId:   string,
  amount:     number,
): Promise<void> {
  if (amount <= 0) throw new Error('amount must be positive');
  if (fromUserId === toUserId) throw new Error('Cannot transfer to yourself');

  await deductCoins(guildId, fromUserId, amount, 'gift_sent',      { to: toUserId });
  await addCoins   (guildId, toUserId,   amount, 'gift_received',  { from: fromUserId });
}

// ── Claim daily coins (100 coins, 24h cooldown) ───────────────────────────
export const DAILY_AMOUNT   = 100;
export const DAILY_COOLDOWN = 24 * 60 * 60 * 1000; // ms

export async function claimDaily(
  guildId: string,
  userId:  string,
): Promise<{ success: boolean; msRemaining?: number; newBalance?: number }> {
  const bal = await getBalance(guildId, userId);
  if (bal.last_daily) {
    const elapsed = Date.now() - new Date(bal.last_daily).getTime();
    if (elapsed < DAILY_COOLDOWN) {
      return { success: false, msRemaining: DAILY_COOLDOWN - elapsed };
    }
  }

  // Set last_daily first to prevent race conditions
  await supabase.from('server_economy').upsert({
    guild_id:   guildId,
    user_id:    userId,
    last_daily: new Date().toISOString(),
  }, { onConflict: 'guild_id,user_id' });

  const newBalance = await addCoins(guildId, userId, DAILY_AMOUNT, 'daily');
  return { success: true, newBalance };
}

// ── Coin rates for passive earning ────────────────────────────────────────
export const COINS_PER_MESSAGE      = 2;
export const COINS_PER_VOICE_5MIN   = 5;
export const COINS_PER_QUEST: Record<string, number> = {
  easy:   25,
  normal: 50,
  hard:   75,
};
