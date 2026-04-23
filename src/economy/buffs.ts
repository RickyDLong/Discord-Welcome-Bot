import { supabase } from '../db/supabase';

export type BuffType =
  | 'xp_boost'
  | 'coin_boost_msg'
  | 'coin_boost_voice'
  | 'daily_double'
  | 'lucky_charm'
  | 'house_edge'
  | 'quest_reroll';

export interface ActiveBuff {
  id:           string;
  buff_type:    BuffType;
  multiplier:   number;
  expires_at:   string | null;
  used:         boolean;
  created_at:   string;
}

// ── Get first valid (unused / unexpired) buff for a type ─────────────────────
export async function getActiveBuff(
  guildId:  string,
  userId:   string,
  buffType: BuffType,
): Promise<ActiveBuff | null> {
  const now = new Date().toISOString();

  // Timed buff (has expiry, not yet expired)
  const { data: timed } = await supabase
    .from('user_buffs')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('buff_type', buffType)
    .eq('used', false)
    .gt('expires_at', now)
    .limit(1)
    .maybeSingle();

  if (timed) return timed as ActiveBuff;

  // One-shot buff (no expiry, not yet used)
  const { data: oneShot } = await supabase
    .from('user_buffs')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('buff_type', buffType)
    .eq('used', false)
    .is('expires_at', null)
    .limit(1)
    .maybeSingle();

  return (oneShot as ActiveBuff | null);
}

// ── Get all active buffs for a user (for /boosts display) ───────────────────
export async function getActiveBuffs(
  guildId: string,
  userId:  string,
): Promise<ActiveBuff[]> {
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('user_buffs')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('used', false)
    .or(`expires_at.gt.${now},expires_at.is.null`)
    .order('created_at', { ascending: false });

  return (data ?? []) as ActiveBuff[];
}

// ── Grant a buff to a user ───────────────────────────────────────────────────
export async function grantBuff(
  guildId:      string,
  userId:       string,
  buffType:     BuffType,
  multiplier:   number,
  durationHours: number | null,
): Promise<void> {
  const expiresAt = durationHours
    ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
    : null;

  await supabase.from('user_buffs').insert({
    guild_id:  guildId,
    user_id:   userId,
    buff_type: buffType,
    multiplier,
    expires_at: expiresAt,
    used:      false,
  });
}

// ── Consume a one-shot buff (mark used) ─────────────────────────────────────
export async function consumeBuff(id: string): Promise<void> {
  await supabase.from('user_buffs').update({ used: true }).eq('id', id);
}

// ── Human-readable buff labels ───────────────────────────────────────────────
export const BUFF_LABELS: Record<BuffType, string> = {
  xp_boost:          '⚡ XP Surge',
  coin_boost_msg:    '💬 Coin Magnet',
  coin_boost_voice:  '🎙️ Voice Bonus',
  daily_double:      '🌟 Daily Double',
  lucky_charm:       '🍀 Lucky Charm',
  house_edge:        '🎲 House Edge',
  quest_reroll:      '🔄 Quest Reroll',
};
