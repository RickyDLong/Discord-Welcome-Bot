import { MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import { supabase } from '../db/supabase';

export async function handleMessageReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  if (user.bot || !reaction.message.guild) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (user.partial) await user.fetch();
    await supabase.from('reaction_events').insert({
      guild_id: reaction.message.guild.id,
      user_id: user.id,
      message_id: reaction.message.id,
      channel_id: reaction.message.channel.id,
      emoji: reaction.emoji.toString(),
      event_type: 'remove',
    });
  } catch (e) {
    console.error('[ReactionRemove] Error:', e);
  }
}
