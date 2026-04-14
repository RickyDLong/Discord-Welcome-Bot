import { MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';
import { updateQuestProgress } from '../quests/dailyQuestEngine';

export async function handleMessageReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
) {
  if (user.bot || !reaction.message.guild) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (user.partial) await user.fetch();
    const guildId = reaction.message.guild.id;
    const reactorId = user.id;
    const authorId = reaction.message.author?.id;
    const client = reaction.client;

    await supabase.from('reaction_events').insert({
      guild_id: guildId, user_id: reactorId,
      message_id: reaction.message.id,
      channel_id: reaction.message.channel.id,
      emoji: reaction.emoji.toString(),
      event_type: 'add',
    });

    // Quest progress: count reactions added by the reactor
    await updateQuestProgress(guildId, reactorId, 'reactions', 1, client);

    if (authorId && authorId !== reactorId) {
      await awardPoints(guildId, authorId, 1, 'reaction_received');
    }
  } catch (e) {
    console.error('[ReactionAdd] Error:', e);
  }
}
