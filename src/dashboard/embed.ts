import { Client, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { config } from '../config';
import { supabase } from '../db/supabase';
import { TIERS, getTierForPoints } from '../points/tiers';
import { activeSessions } from '../events_v2/voiceStateUpdate';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierLabel(points: number): string {
  return getTierForPoints(points).name;
}

function fmtVoice(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

// ── Main dashboard update ─────────────────────────────────────────────────────

export async function updateDashboard(client: Client): Promise<void> {
  try {
    const guild   = client.guilds.cache.get(config.GUILD_ID);
    const channel = client.channels.cache.get(config.STATS_CHANNEL_ID) as TextChannel | undefined;
    if (!guild || !channel) return;

    const today = new Date().toISOString().split('T')[0]!;

    // ── Fetch everything in parallel ─────────────────────────────────────────
    const [
      memberData,
      voiceTop,
      msgTop,
      streakTop,
      recentJoins,
      xpTop,
      questsToday,
      recentAchievements,
      reactionsToday,
      allPoints,
    ] = await Promise.all([
      guild.members.fetch(),

      supabase.from('voice_sessions')
        .select('user_id, duration_seconds')
        .eq('guild_id', config.GUILD_ID)
        .gte('started_at', today)
        .not('duration_seconds', 'is', null),

      supabase.from('message_events')
        .select('user_id')
        .eq('guild_id', config.GUILD_ID)
        .gte('created_at', today),

      supabase.from('daily_streaks')
        .select('user_id, streak_count')
        .eq('guild_id', config.GUILD_ID)
        .order('streak_count', { ascending: false })
        .limit(3),

      supabase.from('member_events')
        .select('user_id, username, event_type, created_at')
        .eq('guild_id', config.GUILD_ID)
        .in('event_type', ['join', 'leave'])
        .order('created_at', { ascending: false })
        .limit(5),

      // 🏆 All-time XP leaderboard
      supabase.from('user_points')
        .select('user_id, total_earned')
        .eq('guild_id', config.GUILD_ID)
        .order('total_earned', { ascending: false })
        .limit(3),

      // 🎯 Quest completions today
      supabase.from('daily_quest_progress')
        .select('user_id, quest_id')
        .eq('guild_id', config.GUILD_ID)
        .eq('quest_date', today)
        .eq('completed', true),

      // 🏅 Recent achievements (server-wide)
      supabase.from('user_achievements')
        .select('user_id, achievement_id, earned_at, achievement_definitions(name, emoji)')
        .eq('guild_id', config.GUILD_ID)
        .order('earned_at', { ascending: false })
        .limit(4),

      // ⚡ Reactions today
      supabase.from('reaction_events')
        .select('user_id')
        .eq('guild_id', config.GUILD_ID)
        .eq('event_type', 'add')
        .gte('created_at', today),

      // 📊 All points for tier distribution
      supabase.from('user_points')
        .select('total_earned')
        .eq('guild_id', config.GUILD_ID),
    ]);

    // ── Aggregations ─────────────────────────────────────────────────────────

    const totalMembers  = memberData.size;
    const onlineMembers = memberData.filter(m => m.presence?.status === 'online').size;
    const idleMembers   = memberData.filter(m => m.presence?.status === 'idle').size;
    const dndMembers    = memberData.filter(m => m.presence?.status === 'dnd').size;

    // Persist member count so the REST API can serve it without Discord client access
    void supabase.from('guild_stats').upsert({
      guild_id:     config.GUILD_ID,
      member_count: totalMembers,
      online_count: onlineMembers,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'guild_id' });

    // Voice
    const voiceAgg = new Map<string, number>();
    (voiceTop.data ?? []).forEach(r =>
      voiceAgg.set(r.user_id, (voiceAgg.get(r.user_id) ?? 0) + (r.duration_seconds as number)),
    );
    const topVoice = [...voiceAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const totalVoiceSecs = [...voiceAgg.values()].reduce((a, b) => a + b, 0);

    // Messages
    const msgAgg = new Map<string, number>();
    (msgTop.data ?? []).forEach(r => msgAgg.set(r.user_id, (msgAgg.get(r.user_id) ?? 0) + 1));
    const topMsg = [...msgAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const totalMsgsToday = [...msgAgg.values()].reduce((a, b) => a + b, 0);

    // Reactions
    const rxnAgg = new Map<string, number>();
    (reactionsToday.data ?? []).forEach(r => rxnAgg.set(r.user_id, (rxnAgg.get(r.user_id) ?? 0) + 1));
    const topRxn = [...rxnAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const totalRxnToday = [...rxnAgg.values()].reduce((a, b) => a + b, 0);

    // Quests
    const questCompletions = questsToday.data ?? [];
    const totalQuestsToday = questCompletions.length;
    const userQuestCount = new Map<string, number>();
    questCompletions.forEach(r =>
      userQuestCount.set(r.user_id as string, (userQuestCount.get(r.user_id as string) ?? 0) + 1),
    );
    const tripleThreatUsers = [...userQuestCount.entries()].filter(([, c]) => c >= 3).map(([uid]) => uid);

    // Tier distribution
    const tierCounts = new Map<string, number>(TIERS.map(t => [t.name, 0]));
    (allPoints.data ?? []).forEach(r => {
      const tier = tierLabel(r.total_earned as number ?? 0);
      tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
    });
    const tierDist = [...TIERS].reverse()
      .map(t => ({ ...t, count: tierCounts.get(t.name) ?? 0 }))
      .filter(t => t.count > 0)
      .map(t => `${t.emoji} **${t.count}**`)
      .join('  ');

    // Active unique members today (sent msg or in voice)
    const activeToday = new Set([...msgAgg.keys(), ...voiceAgg.keys()]).size;

    // Activity Score: weighted composite of today's interactions
    const activityScore = Math.round(
      totalMsgsToday * 1 +
      (totalVoiceSecs / 60) * 2 +
      totalRxnToday * 0.5 +
      totalQuestsToday * 10,
    );

    // Live voice channels
    const liveVoice = guild.channels.cache
      .filter(ch =>
        (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) &&
        'members' in ch &&
        (ch as any).members.size > 0,
      )
      .map(ch => {
        const names = [...(ch as any).members.values()]
          .map((m: any) => m.displayName)
          .join(', ');
        return `**#${ch.name}** (${(ch as any).members.size}) — ${names}`;
      });

    // ── Name resolution ───────────────────────────────────────────────────────
    const fmtName = async (uid: string) => {
      try { return (await guild.members.fetch(uid)).displayName; }
      catch { return `<@${uid}>`; }
    };

    const [voiceLines, msgLines, streakLines, xpLines, rxnLines, tripleThreatNames, achievementLines] =
      await Promise.all([
        Promise.all(topVoice.map(async ([uid, secs], i) =>
          `${MEDALS[i]!} **${await fmtName(uid)}** — ${fmtVoice(secs)}`,
        )),
        Promise.all(topMsg.map(async ([uid, count], i) =>
          `${MEDALS[i]!} **${await fmtName(uid)}** — ${count} msgs`,
        )),
        Promise.all((streakTop.data ?? []).map(async (r, i) =>
          `${MEDALS[i]!} **${await fmtName(r.user_id as string)}** — ${r.streak_count} days 🔥`,
        )),
        Promise.all((xpTop.data ?? []).map(async (r, i) => {
          const tier = getTierForPoints((r.total_earned as number) ?? 0);
          return `${MEDALS[i]!} **${await fmtName(r.user_id as string)}** — ${((r.total_earned as number) ?? 0).toLocaleString()} XP  ${tier.emoji}`;
        })),
        Promise.all(topRxn.map(async ([uid, count], i) =>
          `${MEDALS[i]!} **${await fmtName(uid)}** — ${count} 👍`,
        )),
        Promise.all(tripleThreatUsers.slice(0, 3).map(uid => fmtName(uid))),
        Promise.all((recentAchievements.data ?? []).map(async r => {
          const def = r.achievement_definitions as Record<string, any> | null;
          const name = await fmtName(r.user_id as string);
          const minsAgo = Math.round((Date.now() - new Date(r.earned_at as string).getTime()) / 60000);
          const timeStr = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ago`;
          return `${def?.emoji ?? '🏅'} **${name}** — ${def?.name ?? r.achievement_id} · *${timeStr}*`;
        })),
      ]);

    const recentActivity = (recentJoins.data ?? []).map(r =>
      `${r.event_type === 'join' ? '✅' : '👋'} **${r.username as string}** ${r.event_type === 'join' ? 'joined' : 'left'}`,
    );

    // Quest pulse field value
    let questPulse: string;
    if (totalQuestsToday === 0) {
      questPulse = '*No quests completed yet today*';
    } else {
      questPulse = `**${totalQuestsToday}** completed by **${userQuestCount.size}** member${userQuestCount.size !== 1 ? 's' : ''}`;
      if (tripleThreatNames.length > 0) {
        questPulse += `\n🎰 Triple Threat: ${tripleThreatNames.join(', ')}`;
      }
    }

    // ── Build embed ───────────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('📊  Archix Digital — Live Server Stats')
      .setDescription(
        `Updated every 5 minutes · [Full Dashboard](https://archix-stats.vercel.app)\n` +
        `⚡ **Activity Score: ${activityScore.toLocaleString()}**  ·  **${activeToday}** active members today`,
      )
      .addFields(
        // ── Row 1: Server overview ──────────────────────────────────────────
        {
          name: '👥 Members',
          value: [
            `**${totalMembers}** total`,
            `🟢 **${onlineMembers}** online`,
            `🌙 **${idleMembers}** idle`,
            `⛔ **${dndMembers}** dnd`,
            `🎙️ **${activeSessions.size}** in voice`,
          ].join('  ·  '),
          inline: false,
        },
        // ── Row 2: Live voice ───────────────────────────────────────────────
        {
          name: '🔊 Live Voice Channels',
          value: liveVoice.length ? liveVoice.join('\n') : '*No one in voice right now*',
          inline: false,
        },
        // ── Row 3: Leaderboards (3 inline) ─────────────────────────────────
        {
          name: '🏆 XP Leaderboard (All-Time)',
          value: xpLines.length ? xpLines.join('\n') : '*No XP earned yet*',
          inline: true,
        },
        {
          name: `🎙️ Top Voice Today  (${fmtVoice(totalVoiceSecs)} total)`,
          value: voiceLines.length ? voiceLines.join('\n') : '*No voice activity*',
          inline: true,
        },
        {
          name: `💬 Top Chatters Today  (${totalMsgsToday} msgs)`,
          value: msgLines.length ? msgLines.join('\n') : '*No messages today*',
          inline: true,
        },
        // ── Row 4: More leaderboards (3 inline) ────────────────────────────
        {
          name: `⚡ Top Reactors Today  (${totalRxnToday} total)`,
          value: rxnLines.length ? rxnLines.join('\n') : '*No reactions today*',
          inline: true,
        },
        {
          name: '🔥 Longest Streaks',
          value: streakLines.length ? streakLines.join('\n') : '*No streaks yet*',
          inline: true,
        },
        {
          name: '🎯 Quest Pulse',
          value: questPulse,
          inline: true,
        },
        // ── Row 5: Achievements + Tiers ─────────────────────────────────────
        {
          name: '🏅 Latest Achievements Unlocked',
          value: achievementLines.length ? achievementLines.join('\n') : '*No achievements earned yet*',
          inline: false,
        },
        {
          name: '📊 Tier Distribution',
          value: tierDist || '*No members ranked yet*',
          inline: false,
        },
        // ── Row 6: Activity feed ────────────────────────────────────────────
        {
          name: '📋 Recent Activity',
          value: recentActivity.length ? recentActivity.join('\n') : '*No recent joins or leaves*',
          inline: false,
        },
      )
      .setFooter({ text: 'Last updated' })
      .setTimestamp();

    // Edit existing message or post new
    const messages = await channel.messages.fetch({ limit: 10 });
    const existing = messages.find(
      m => m.author.id === client.user?.id && m.embeds[0]?.title?.includes('Archix Digital'),
    );

    if (existing) {
      await existing.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[Dashboard] Update error:', err);
  }
}
