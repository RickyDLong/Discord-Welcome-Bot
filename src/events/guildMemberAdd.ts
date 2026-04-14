import {
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Hey ${member.displayName} — welcome to Archix Digital! 👋`)
    .setDescription(
      'Before you jump in, tell us what you\'re about.\n\n' +
      'Pick the option that fits and we\'ll drop you in the right spot.'
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: '🔧 Builder',
        value: 'You ship things — code, design, ideas. You make stuff.',
        inline: true,
      },
      {
        name: '🎮 Gamer',
        value: "You're here for the squads and the sessions.",
        inline: true,
      },
      {
        name: '⚡ Both',
        value: 'Build by day. Frag by night.',
        inline: true,
      }
    )
    .setFooter({ text: 'Archix Digital • You can always grab more roles later.' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('role_builder')
      .setLabel('🔧 Builder')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('role_gamer')
      .setLabel('🎮 Gamer')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('role_both')
      .setLabel('⚡ Both')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await member.send({ embeds: [embed], components: [row] });
    console.log(`📨 DM sent to ${member.user.tag}`);
  } catch {
    // Member has DMs closed — log it and move on, don't crash
    console.warn(
      `⚠️  Could not DM ${member.user.tag} — they likely have DMs disabled.`
    );
  }
}
