import { VoiceState } from 'discord.js';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';
import { checkAndUpdateStreak } from '../points/streaks';
import { checkVoiceAchievements } from '../achievements/engine';
import { updateQuestProgress } from '../quests/dailyQuestEngine';

export const voiceSessions = new Map<string, { channelId: string; joinedAt: Date }>();
// Alias used by dashboard/embed.ts
export const activeSessions = voiceSessions;

function key(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

async function closeSession(
  guildId: string,
  userId: string,
  channelId: string,
  joinedAt: Date,
  client: VoiceState['client'],
) {
  const duration = Math.floor((Date.now() - joinedAt.getTime()) / 1000);
  await supabase.from('voice_sessions').insert({
    guild_id: guildId, user_id: userId, channel_id: channelId,
    joined_at: joinedAt.toISOString(),
    left_at: new Date().toISOString(),
    duration_seconds: duration,
  });

  if (duration >= 60) {
    const minutes = Math.floor(duration / 60);

    // Quest progress: award voice minutes
    await updateQuestProgress(guildId, userId, 'voice_minutes', minutes, client);

    const pts = Math.floor(duration / 300) * 2;
    if (pts > 0) {
      await awardPoints(guildId, userId, pts, 'voice_time');
      await checkAndUpdateStreak(guildId, userId);
    }

    await checkVoiceAchievements(guildId, userId, client);
  }
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const guildId = newState.guild.id;
  const userId = newState.id;
  const k = key(guildId, userId);
  const client = newState.client;
  try {
    if (oldState.channelId && !newState.channelId) {
      // User left voice
      const session = voiceSessions.get(k);
      if (session) {
        await closeSession(guildId, userId, session.channelId, session.joinedAt, client);
        voiceSessions.delete(k);
      }
    } else if (!oldState.channelId && newState.channelId) {
      // User joined voice — seed display name into user_profiles
      void supabase.from('user_profiles').upsert({
        guild_id:     guildId,
        user_id:      userId,
        username:     newState.member?.user.username ?? userId,
        display_name: newState.member?.displayName ?? newState.member?.user.username ?? userId,
        avatar_hash:  newState.member?.user.avatar ?? null,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'guild_id,user_id' });
      voiceSessions.set(k, { channelId: newState.channelId, joinedAt: new Date() });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      // User switched channels
      const session = voiceSessions.get(k);
      if (session) await closeSession(guildId, userId, session.channelId, session.joinedAt, client);
      voiceSessions.set(k, { channelId: newState.channelId, joinedAt: new Date() });
    }

    const events: string[] = [];
    if (oldState.selfMute !== newState.selfMute)       events.push(newState.selfMute ? 'mute' : 'unmute');
    if (oldState.selfDeaf !== newState.selfDeaf)       events.push(newState.selfDeaf ? 'deafen' : 'undeafen');
    if (oldState.streaming !== newState.streaming)     events.push(newState.streaming ? 'stream_start' : 'stream_end');
    if (oldState.selfVideo !== newState.selfVideo)     events.push(newState.selfVideo ? 'video_start' : 'video_end');
    for (const ev of events) {
      await supabase.from('voice_events').insert({
        guild_id: guildId, user_id: userId,
        channel_id: newState.channelId ?? oldState.channelId,
        event_type: ev,
      });
    }
  } catch (e) {
    console.error('[VoiceStateUpdate] Error:', e);
  }
}
