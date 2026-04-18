import { Message } from 'discord.js';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';
import { checkAndUpdateStreak } from '../points/streaks';
import { checkMessageAchievements, checkStreakAchievements } from '../achievements/engine';
import { updateQuestProgress } from '../quests/dailyQuestEngine';

const messageCooldown = new Map<string, number>();
const COOLDOWN_MS = 60_000;

export async function handleMessageCreate(message: Message) {
  if (message.author.bot || !message.guild) return;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const client = message.client;
  try {
    await supabase.from('message_events').insert({
      guild_id: guildId, user_id: userId,
      channel_id: message.channel.id,
      message_id: message.id,
      char_length: message.content.length,
    });

    // Keep user profile up to date for display name resolution
    void supabase.from('user_profiles').upsert({
      guild_id:     guildId,
      user_id:      userId,
      username:     message.author.username,
      display_name: message.member?.displayName ?? message.author.username,
      avatar_hash:  message.author.avatar,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'guild_id,user_id' });

    // Quest progress: count every message (no cooldown)
    await updateQuestProgress(guildId, userId, 'messages', 1, client);

    const now = Date.now();
    if (now - (messageCooldown.get(userId) ?? 0) >= COOLDOWN_MS) {
      messageCooldown.set(userId, now);
      await awardPoints(guildId, userId, 1, 'message');
      const newStreak = await checkAndUpdateStreak(guildId, userId);
      await checkMessageAchievements(guildId, userId, client);
      await checkStreakAchievements(guildId, userId, newStreak, client);
    }
  } catch (e) {
    console.error('[MessageCreate] Error:', e);
  }
}
