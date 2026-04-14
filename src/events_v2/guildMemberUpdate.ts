import { GuildMember, PartialGuildMember } from 'discord.js';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';

export async function handleGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  try {
    const guildId = newMember.guild.id;
    const userId = newMember.id;
    if (!oldMember.premiumSince && newMember.premiumSince) {
      await supabase.from('member_events').insert({
        guild_id: guildId, user_id: userId,
        username: newMember.user.username, event_type: 'boost',
      });
      await awardPoints(guildId, userId, 100, 'server_boost');
    }
    if (oldMember.roles && newMember.roles) {
      const oldRoles = oldMember.roles.cache ?? new Map();
      const newRoles = newMember.roles.cache;
      for (const [id, role] of newRoles) {
        if (!oldRoles.has(id)) {
          await supabase.from('member_events').insert({
            guild_id: guildId, user_id: userId,
            username: newMember.user.username, event_type: 'role_add',
            metadata: { role_id: id, role_name: role.name },
          });
        }
      }
      for (const [id, role] of oldRoles) {
        if (!newRoles.has(id)) {
          await supabase.from('member_events').insert({
            guild_id: guildId, user_id: userId,
            username: newMember.user.username, event_type: 'role_remove',
            metadata: { role_id: id, role_name: role.name },
          });
        }
      }
    }
  } catch (e) {
    console.error('[MemberUpdate] Error:', e);
  }
}
