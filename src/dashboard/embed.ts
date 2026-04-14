import { Client, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { config } from '../config';
import { supabase } from '../db/supabase';
import { getTierForPoints } from '../points/tiers';
import { activeSessions } from '../events_v2/voiceStateUpdate';

export async function updateDashboard(client: Client): Promise<void> {
  try {
    const guild   = client.guilds.cache.get(config.GUILD_ID);
    const channel = client.channels.cache.get(config.STATS_CHANNEL_ID) as TextChannel | undefined;
    if (!guild || !channel) return;

    const today = new Date().toISOString().split('T')[0]!;

    // Fetch data in parallel
    const [memberData, voiceTop, msgTop, streakTop, recentJoins] = await Promise.all([
      // Member count
      guild.members.fetch(),
      // Top voice users today
      supabase.from('voice_sessions')
        .select('user_id, duration_seconds')
        .eq('guild_id', config.GUILD_ID)
        .gte('started_at', today)
        .not('duration_seconds', 'is', null),
      // Top message senders today
      supabase.from('message_events')
        .select('user_id')
        .eq('guild_id', config.GUILD_ID)
        .gte('created_at', today),
      // Top streaks
      supabase.from('daily_streaks')
        .select('user_id, streak_count')
        .eq('guild_id', config.GUILD_ID)
        .order('streak_count', { ascending: false })
        .limit(3),
      // Recent joins/leaves
      supabase.from('member_events')
        .select('user_id, username, event_type, created_at')
        .eq('guild_id', config.GUILD_ID)
        .in('event_type', ['join', 'leave'])
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const totalMembers  = memberData.size;
    const onlineMembers = memberData.filter(m => m.presence?.status === 'online').size;

    // Aggregate voice time
    const voiceAgg = new Map<string, number>();
    (voiceTop.data ?? []).forEach(r => voiceAgg.set(r.user_id, (voiceAgg.get(r.user_id) ?? 0) + r.duration_seconds));
    const topVoice = [...voiceAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Aggregate messages
    const msgAgg = new Map<string, number>();
    (msgTop.data ?? []).forEach(r => msgAgg.set(r.user_id, (msgAgg.get(r.user_id) ?? 0) + 1));
    const topMsg = [...msgAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const totalVoiceSecs = [...voiceAgg.values()].reduce((a, b) => a + b, 0);

    // Live voice channels
    const liveVoice = guild.channels.cache
      .filter(ch => (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) && 'members' in ch && (ch as any).members.size > 0)
      .map(ch => {
        const members = [...(ch as any).members.values()].map((m: any) => m.displayName).join(', ');
        return `**#${ch.name}** (${(ch as any).members.size}) — ${members}`;
      });

    // Format helpers
    const fmtName = async (userId: string) => {
      try { return (await guild.members.fetch(userId)).displayName; } catch { return userId; }
    };

    const voiceLines = await Promise.all(topVoice.map(async ([uid, secs], i) => {
      const name = await fmtName(uid);
      const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
      return `${['🥇','🥈','🥉'][i] ?? (i+1)+'.'} **${name}** — ${h}h ${m}m`;
    }));

    const msgLines = await Promise.all(topMsg.map(async ([uid, count], i) => {
      const name = await fmtName(uid);
      return `${['🥇','🥈','🥉'][i] ?? (i+1)+'.'} **${name}** — ${count} msgs`;
    }));

    const streakLines = await Promise.all((streakTop.data ?? []).map(async (r, i) => {
      const name = await fmtName(r.user_id);
      return `${['🥇','🥈','🥉'][i] ?? (i+1)+'.'} **${name}** — ${r.streak_count} days 🔥`;
    }));

    const recentActivity = (recentJoins.data ?? []).map(r =>
      `${r.event_type === 'join' ? '✅' : '👋'} **${r.username}** ${r.event_type === 'join' ? 'joined' : 'left'}`
    );

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('📊 Archix Digital — Live Server Stats')
      .setDescription('Updated every 5 minutes · [Full Dashboard](https://archix-stats.vercel.app)')
      .addFields(
        {
          name: '👥 Server',
          value: [
            `**${totalMembers}** members`,
            `**${onlineMembers}** online`,
            `**${activeSessions.size}** in voice now`,
          ].join(' · '),
          inline: false,
        },
        {
          name: '🔊 Live Voice Channels',
          value: liveVoice.length ? liveVoice.join('\n') : '*No one in voice right now*',
          inline: false,
        },
        {
          name: `🎙️ Top Voice Today (${Math.floor(totalVoiceSecs / 3600)}h total)`,
          value: voiceLines.length ? voiceLines.join('\n') : '*No voice activity today*',
          inline: true,
        },
        {
          name: '💬 Top Chatters Today',
          value: msgLines.length ? msgLines.join('\n') : '*No messages today*',
          inline: true,
        },
        {
          name: '🔥 Longest Streaks',
          value: streakLines.length ? streakLines.join('\n') : '*No streaks yet*',
          inline: false,
        },
        {
          name: '📋 Recent Activity',
          value: recentActivity.length ? recentActivity.join('\n') : '*No recent activity*',
          inline: false,
        },
      )
      .setFooter({ text: `Last updated` })
      .setTimestamp();

    // Find existing dashboard message and edit it, or post new one
    const messages = await channel.messages.fetch({ limit: 10 });
    const existing = messages.find(m => m.author.id === client.user?.id && m.embeds[0]?.title?.includes('Archix Digital'));

    if (existing) {
      await existing.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Dashboard update error:', err);
  }
}
