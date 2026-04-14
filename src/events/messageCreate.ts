import { Message } from 'discord.js';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';
import { checkAndUpdateStreak } from '../points/streaks';

const messageCooldown = new Map<string, number>();
const COOLDOWN_MS = 60_000;

export async function handleMessageCreate(message: Message) {
  if (message.author.bot || !message.guild) return;
  const guildId = message.guild.id;
  const userId = message.author.id;

  try {
    await supabase.from('message_events').insert({
      guild_id: guildId, user_id: userId,
      channel_id: message.channel.id,
      message_id: message.id,
      char_length: message.content.length,
    });

    const now = Date.now();
    if (now - (messageCooldown.get(userId) ?? 0) >= COOLDOWN_MS) {
      messageCooldown.set(userId, now);
      await awardPoints(guildId, userId, 1, 'message');
      await checkAndUpdateStreak(guildId, userId);
    }
  } catch (e) {
    console.error('[MessageCreate] Error:', e);
  }
}
