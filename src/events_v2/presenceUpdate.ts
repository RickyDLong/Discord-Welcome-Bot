import { Presence } from 'discord.js';
import { supabase } from '../db/supabase';

export async function handlePresenceUpdate(oldPresence: Presence | null, newPresence: Presence) {
  if (!newPresence.guild || !newPresence.user) return;
  if ((oldPresence?.status ?? 'offline') === newPresence.status) return;
  try {
    await supabase.from('presence_events').insert({
      guild_id: newPresence.guild.id,
      user_id: newPresence.user.id,
      status: newPresence.status,
    });
  } catch (e) {
    console.error('[PresenceUpdate] Error:', e);
  }
}
