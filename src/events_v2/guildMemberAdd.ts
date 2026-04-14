import { GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';

export async function handleGuildMemberAdd(member: GuildMember) {
  try {
    await supabase.from('member_events').insert({
      guild_id: member.guild.id,
      user_id: member.id,
      username: member.user.username,
      event_type: 'join',
    });
    await awardPoints(member.guild.id, member.id, 10, 'join_bonus');
    const role = member.guild.roles.cache.get(config.ROLE_COMMUNITY_MEMBER);
    if (role) await member.roles.add(role).catch(console.error);
    const embed = new EmbedBuilder()
      .setTitle(`Welcome to ${member.guild.name}! 🎉`)
      .setDescription(
        `Hey **${member.user.username}**, welcome aboard!\n\n` +
        `Pick your roles below and introduce yourself in the community.\n\n` +
        `You earned **10 points** just for joining!`
      )
      .setColor(0x5865f2)
      .setThumbnail(member.user.displayAvatarURL());
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('role_builder').setLabel('🛠️ Builder').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('role_gamer').setLabel('🎮 Gamer').setStyle(ButtonStyle.Secondary),
    );
    await member.send({ embeds: [embed], components: [row] }).catch(() => {});
    console.log(`[MemberAdd] ${member.user.username} joined`);
  } catch (e) {
    console.error('[MemberAdd] Error:', e);
  }
}
