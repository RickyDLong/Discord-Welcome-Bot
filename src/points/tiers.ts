import { supabase } from '../db/supabase';
import { Client } from 'discord.js';

export interface Tier {
  name:        string;
  minPoints:   number;
  roleId:      string | null;
  color:       number;
  emoji:       string;
}

// Default tier config — override via DB in future
export const TIERS: Tier[] = [
  { name: 'Member',   minPoints: 0,     roleId: null, color: 0x95a5a6, emoji: '⚪' },
  { name: 'Active',   minPoints: 100,   roleId: null, color: 0x3498db, emoji: '🔵' },
  { name: 'Regular',  minPoints: 500,   roleId: null, color: 0x2ecc71, emoji: '🟢' },
  { name: 'Veteran',  minPoints: 2000,  roleId: null, color: 0x9b59b6, emoji: '🟣' },
  { name: 'Elite',    minPoints: 5000,  roleId: null, color: 0xf39c12, emoji: '🟡' },
  { name: 'Legend',   minPoints: 15000, roleId: null, color: 0xe74c3c, emoji: '🔴' },
];

export function getTierForPoints(totalEarned: number): Tier {
  const tier = [...TIERS].reverse().find(t => totalEarned >= t.minPoints);
  return tier ?? TIERS[0]!;
}

export async function checkTierProgression(userId: string, guildId: string, totalEarned: number): Promise<void> {
  const { data: current } = await supabase
    .from('user_tiers')
    .select('tier_name')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  const newTier = getTierForPoints(totalEarned);
  const currentTierName = current?.tier_name ?? 'Member';

  if (newTier.name !== currentTierName) {
    await supabase.from('user_tiers').upsert({
      user_id: userId, guild_id: guildId,
      tier_name: newTier.name, achieved_at: new Date().toISOString(),
    }, { onConflict: 'user_id,guild_id' });

    console.log(`🏆 ${userId} leveled up to ${newTier.name}`);
  }
}

export async function applyTierRoles(client: Client, guildId: string, userId: string, tierName: string): Promise<void> {
  // Future: assign Discord roles based on tier
  // Requires tier_roles table mapping tier names to role IDs
  console.log(`Tier role apply: ${userId} -> ${tierName}`);
}
