import { GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelType } from 'discord.js';
import { config } from '../config';
import { supabase } from '../db/supabase';
import { awardPoints } from '../points/engine';
import { checkAndAwardAchievement } from '../achievements/engine';

/** Find the best channel to post a welcome message in for any guild */
function resolveWelcomeChannel(member: GuildMember): TextChannel | undefined {
  const guild = member.guild;

  // Primary guild: use configured channel
  if (guild.id === config.GUILD_ID) {
    return guild.channels.cache.get(config.WELCOME_CHANNEL_ID) as TextChannel | undefined;
  }

  // Other guilds: prefer system channel, then #general or #welcome, then first writable text channel
  if (guild.systemChannel) return guild.systemChannel;

  const byName = guild.channels.cache.find(
    ch =>
      ch.type === ChannelType.GuildText &&
      (ch.name === 'general' || ch.name === 'welcome' || ch.name === 'introductions'),
  ) as TextChannel | undefined;
  if (byName) return byName;

  return guild.channels.cache.find(
    ch =>
      ch.type === ChannelType.GuildText &&
      ch.permissionsFor(guild.members.me!)?.has('SendMessages'),
  ) as TextChannel | undefined;
}

export async function handleGuildMemberAdd(member: GuildMember) {
  try {
    await supabase.from('member_events').insert({
      guild_id: member.guild.id,
      user_id: member.id,
      username: member.user.username,
      event_type: 'join',
    });
    await awardPoints(member.guild.id, member.id, 10, 'join_bonus');

    // OG achievement: first 50 members
    if (member.guild.memberCount <= 50) {
      await checkAndAwardAchievement(member.guild.id, member.id, 'og_member', member.client);
    }

    // Assign community member role — only if it exists in this guild
    if (member.guild.id === config.GUILD_ID) {
      const role = member.guild.roles.cache.get(config.ROLE_COMMUNITY_MEMBER);
      if (role) await member.roles.add(role).catch(console.error);
    }

    const welcomeChannel = resolveWelcomeChannel(member);
    if (!welcomeChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`Welcome to ${member.guild.name}! 👋`)
      .setDescription(
        `<@${member.id}> just landed — glad you're here.\n\n` +
        `You're now part of the community. Say hi, earn XP, and check your stats with \`/profile\`.`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: '🚀 Get started',
          value: [
            '**1.** Say hi in chat',
            '**2.** Hop in a voice channel',
            '**3.** Complete daily quests with `/daily`',
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

    // Only show role picker buttons in the primary guild where those roles exist
    if (member.guild.id === config.GUILD_ID) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('role_builder').setLabel('🛠️ Builder').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('role_gamer').setLabel('🎮 Gamer').setStyle(ButtonStyle.Secondary),
      );
      await welcomeChannel.send({ embeds: [embed], components: [row] });
    } else {
      await welcomeChannel.send({ embeds: [embed] });
    }

    console.log(`[MemberAdd] ${member.user.username} joined ${member.guild.name} (${member.guild.memberCount} total)`);
  } catch (e) {
    console.error('[MemberAdd] Error:', e);
  }
}
