import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserPoints } from '../points/engine';
import { getStreak } from '../points/streaks';
import { getTierForPoints } from '../points/tiers';
import { supabase } from '../db/supabase';

export async function handleProfileCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: false });
  const userId  = interaction.user.id;
  const guildId = interaction.guildId!;

  const [{ points, total_earned }, streak] = await Promise.all([
    getUserPoints(userId, guildId),
    getStreak(userId, guildId),
  ]);

  const tier = getTierForPoints(total_earned);

  // Voice time today
  const today = new Date().toISOString().split('T')[0]!;
  const { data: voiceData } = await supabase
    .from('voice_sessions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .gte('started_at', today);
  const voiceSecs = (voiceData ?? []).reduce((acc, r) => acc + (r.duration_seconds ?? 0), 0);
  const voiceHours = Math.floor(voiceSecs / 3600);
  const voiceMins  = Math.floor((voiceSecs % 3600) / 60);

  // Messages today
  const { count: msgCount } = await supabase
    .from('message_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .gte('created_at', today);

  // Quest completions
  const { count: questCount } = await supabase
    .from('quest_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .eq('status', 'approved');

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(`${tier.emoji} ${interaction.user.username}'s Profile`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: '🏆 Tier',           value: tier.name,                            inline: true },
      { name: '💎 Points',         value: points.toLocaleString(),              inline: true },
      { name: '📊 Total Earned',   value: total_earned.toLocaleString(),        inline: true },
      { name: '🔥 Streak',         value: `${streak} days`,                     inline: true },
      { name: '🎙️ Voice Today',    value: `${voiceHours}h ${voiceMins}m`,       inline: true },
      { name: '💬 Messages Today', value: `${msgCount ?? 0}`,                   inline: true },
      { name: '✅ Quests Done',    value: `${questCount ?? 0}`,                 inline: true },
    )
    .setFooter({ text: 'Archix Digital' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
