import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../db/supabase';
import { getTierForPoints } from '../points/tiers';

export async function handleLeaderboardCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const type  = interaction.options.getString('type') ?? 'points';
  const guild = interaction.guild!;
  const today = new Date().toISOString().split('T')[0]!;

  let rows: any[] = [];
  let title = '';
  let valueLabel = '';

  if (type === 'points') {
    const { data } = await supabase
      .from('user_points')
      .select('user_id, total_earned')
      .eq('guild_id', interaction.guildId)
      .order('total_earned', { ascending: false })
      .limit(10);
    rows = data ?? [];
    title = '🏆 All-Time Points Leaderboard';
    valueLabel = 'pts';
  } else if (type === 'voice_today') {
    const { data } = await supabase
      .from('voice_sessions')
      .select('user_id, duration_seconds')
      .eq('guild_id', interaction.guildId)
      .gte('started_at', today)
      .not('duration_seconds', 'is', null);
    const agg = new Map<string, number>();
    (data ?? []).forEach(r => agg.set(r.user_id, (agg.get(r.user_id) ?? 0) + r.duration_seconds));
    rows = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([user_id, total]) => ({ user_id, total_earned: total }));
    title = '🎙️ Voice Time Leaderboard (Today)';
    valueLabel = 's';
  } else if (type === 'messages_today') {
    const { data } = await supabase
      .from('message_events')
      .select('user_id')
      .eq('guild_id', interaction.guildId)
      .gte('created_at', today);
    const agg = new Map<string, number>();
    (data ?? []).forEach(r => agg.set(r.user_id, (agg.get(r.user_id) ?? 0) + 1));
    rows = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([user_id, total_earned]) => ({ user_id, total_earned }));
    title = '💬 Messages Leaderboard (Today)';
    valueLabel = 'msgs';
  } else if (type === 'streak') {
    const { data } = await supabase
      .from('daily_streaks')
      .select('user_id, streak_count')
      .eq('guild_id', interaction.guildId)
      .order('streak_count', { ascending: false })
      .limit(10);
    rows = (data ?? []).map(r => ({ user_id: r.user_id, total_earned: r.streak_count }));
    title = '🔥 Streak Leaderboard';
    valueLabel = 'days';
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = await Promise.all(rows.map(async (row, i) => {
    let name = row.user_id;
    try {
      const member = await guild.members.fetch(row.user_id);
      name = member.displayName;
    } catch {}
    const tier   = getTierForPoints(row.total_earned);
    const medal  = medals[i] ?? `**${i + 1}.**`;
    const val    = type === 'voice_today'
      ? `${Math.floor(row.total_earned / 3600)}h ${Math.floor((row.total_earned % 3600) / 60)}m`
      : `${row.total_earned.toLocaleString()} ${valueLabel}`;
    return `${medal} ${tier.emoji} **${name}** — ${val}`;
  }));

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(title)
    .setDescription(lines.join('\n') || 'No data yet.')
    .setFooter({ text: 'Archix Digital' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
