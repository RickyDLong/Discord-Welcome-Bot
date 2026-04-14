import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';
import { updateDashboard } from '../dashboard/embed';

export async function handleAdminCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'quest_create') {
    await interaction.deferReply({ ephemeral: true });
    const title           = interaction.options.getString('title', true);
    const description     = interaction.options.getString('description', true);
    const pointsReward    = interaction.options.getInteger('points', true);
    const maxCompletions  = interaction.options.getInteger('max_completions') ?? 0;

    const { data } = await supabase.from('quests').insert({
      guild_id: interaction.guildId, title, description,
      points_reward: pointsReward, max_completions: maxCompletions,
      active: true, completions: 0,
    }).select('id').single();

    await interaction.editReply(
      `✅ Quest created! ID: \`${data?.id?.slice(0, 8)}\`\n` +
      `Members can submit with: \`/quest submit ${data?.id?.slice(0, 8)}\``,
    );
  }

  if (sub === 'quest_approve') {
    await interaction.deferReply({ ephemeral: true });
    const subId = interaction.options.getString('submission_id', true);

    const { data: submission } = await supabase
      .from('quest_submissions')
      .select('*, quests(title, points_reward)')
      .ilike('id', `${subId}%`)
      .eq('guild_id', interaction.guildId)
      .eq('status', 'pending')
      .single();

    if (!submission) {
      await interaction.editReply('Submission not found or already reviewed.');
      return;
    }

    await supabase.from('quest_submissions').update({
      status: 'approved', reviewed_by: interaction.user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', submission.id);

    await supabase.from('quests').update({
      completions: submission.quests.completions + 1,
    }).eq('id', submission.quest_id);

    const pts = submission.quests.points_reward;
    await awardPoints(submission.user_id, interaction.guildId!, pts, `quest_${submission.quest_id}`);

    await interaction.editReply(
      `✅ Approved! <@${submission.user_id}> earned **${pts} points** for completing **${submission.quests.title}**.`,
    );
  }

  if (sub === 'award') {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user', true);
    const pts    = interaction.options.getInteger('points', true);
    const reason = interaction.options.getString('reason') ?? 'admin_award';

    await awardPoints(target.id, interaction.guildId!, pts, reason);
    await interaction.editReply(`✅ Awarded **${pts} points** to <@${target.id}>.`);
  }

  if (sub === 'update_dashboard') {
    await interaction.deferReply({ ephemeral: true });
    await updateDashboard(interaction.client);
    await interaction.editReply('✅ Dashboard refreshed.');
  }
}
