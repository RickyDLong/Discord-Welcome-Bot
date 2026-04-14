import { GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
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
      .setColor(0x7c3aed)
      .setTitle(`Welcome to ${member.guild.name}! 👋`)
      .setDescription(
        `<@${member.id}> just landed — glad you're here.\n\n` +
        `Pick your roles below to unlock the right channels, then head to <#${config.WELCOME_CHANNEL_ID}> to say hi.`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: '🚀 First steps',
          value: [
            `**1.** Pick a role with the buttons below`,
            `**2.** Read the rules in <#${config.WELCOME_CHANNEL_ID}>`,
            `**3.** Introduce yourself and start earning XP`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '💎 You already have 10 XP',
          value: 'Earn more by chatting, hopping in voice, and completing quests. Check your progress with `/profile`.',
          inline: false,
        },
        {
          name: '🏆 Tier ladder',
          value: '⚪ Member → 🔵 Active → 🟢 Regular → 🟣 Veteran → 🟡 Elite → 🔴 Legend',
          inline: false,
        },
      )
      .setFooter({ text: `${member.guild.memberCount} members and counting` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('role_builder').setLabel('🛠️ Builder').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('role_gamer').setLabel('🎮 Gamer').setStyle(ButtonStyle.Secondary),
    );

    const welcomeChannel = member.guild.channels.cache.get(config.WELCOME_CHANNEL_ID) as TextChannel | undefined;
    if (welcomeChannel) {
      await welcomeChannel.send({ embeds: [embed], components: [row] });
    }

    console.log(`[MemberAdd] ${member.user.username} joined (${member.guild.memberCount} total)`);
  } catch (e) {
    console.error('[MemberAdd] Error:', e);
  }
}
