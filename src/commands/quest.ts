import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../db/supabase';

export async function handleQuestCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    await interaction.deferReply({ ephemeral: true });
    const { data } = await supabase
      .from('quests')
      .select('*')
      .eq('guild_id', interaction.guildId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (!data?.length) {
      await interaction.editReply('No active quests right now. Check back later!');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('📋 Active Quests')
      .setDescription(data.map(q =>
        `**[${q.id.slice(0, 8)}] ${q.title}**\n${q.description}\n💎 **${q.points_reward} pts** | ` +
        (q.max_completions > 0 ? `${q.completions}/${q.max_completions} completed` : '∞ completions')
      ).join('\n\n'))
      .setFooter({ text: 'Use /quest submit <quest_id> <proof> to submit' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'submit') {
    await interaction.deferReply({ ephemeral: true });
    const questId = interaction.options.getString('quest_id', true);
    const proof   = interaction.options.getString('proof', true);

    const { data: quest } = await supabase
      .from('quests')
      .select('*')
      .eq('id', questId)
      .eq('guild_id', interaction.guildId)
      .eq('active', true)
      .single();

    if (!quest) {
      await interaction.editReply('Quest not found or no longer active.');
      return;
    }

    // Check if already submitted
    const { data: existing } = await supabase
      .from('quest_submissions')
      .select('id, status')
      .eq('quest_id', questId)
      .eq('user_id', interaction.user.id)
      .single();

    if (existing) {
      await interaction.editReply(`You already submitted this quest (status: **${existing.status}**).`);
      return;
    }

    const { data: submission } = await supabase
      .from('quest_submissions')
      .insert({
        guild_id: interaction.guildId, quest_id: questId,
        user_id: interaction.user.id, proof,
        status: 'pending',
      })
      .select('id')
      .single();

    await interaction.editReply(
      `✅ Submission received! ID: \`${submission?.id?.slice(0, 8)}\`\n` +
      'A mod will review and approve it. Points will be awarded on approval.',
    );
  }
}
