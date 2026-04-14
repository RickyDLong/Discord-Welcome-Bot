import { GuildMember, PartialGuildMember } from 'discord.js';
import { supabase } from '../db/supabase';

export async function handleGuildMemberRemove(member: GuildMember | PartialGuildMember) {
  try {
    await supabase.from('member_events').insert({
      guild_id: member.guild.id,
      user_id: member.id,
      username: member.user?.username ?? 'unknown',
      event_type: 'leave',
    });
    console.log(`[MemberRemove] ${member.user?.username ?? member.id} left`);
  } catch (e) {
    console.error('[MemberRemove] Error:', e);
  }
}
