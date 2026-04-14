import { Client, ChannelType } from 'discord.js';
import { config } from '../config';
import { supabase } from '../db/supabase';

export function startVoiceSnapshotScheduler(client: Client): void {
  // Snapshot every 2 minutes
  setInterval(() => takeVoiceSnapshot(client), 2 * 60 * 1000);
  console.log('📸 Voice snapshot scheduler started (every 2 min)');
}

async function takeVoiceSnapshot(client: Client): Promise<void> {
  try {
    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild) return;

    const voiceChannels = guild.channels.cache.filter(
      ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice,
    );

    const snapshots = voiceChannels
      .filter(ch => 'members' in ch && (ch as any).members.size > 0)
      .map(ch => {
        const vc = ch as any;
        return {
          guild_id:     guild.id,
          channel_id:   ch.id,
          channel_name: ch.name,
          member_count: vc.members.size,
          members:      vc.members.map((m: any) => ({
            user_id:  m.id,
            username: m.user.username,
          })),
        };
      });

    if (snapshots.length > 0) {
      await supabase.from('voice_channel_snapshots').insert(snapshots);
    }
  } catch (err) {
    console.error('Voice snapshot error:', err);
  }
}
