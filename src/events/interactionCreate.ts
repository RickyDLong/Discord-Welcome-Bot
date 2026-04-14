import {
  Interaction,
  GuildMember,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { config } from '../config';

// Maps button ID → role IDs to assign
const ROLE_MAP: Record<string, Array<keyof typeof config.roles>> = {
  role_builder: ['communityMember', 'builder'],
  role_gamer:   ['communityMember', 'gamer'],
  role_both:    ['communityMember', 'builder', 'gamer'],
};

// Human-readable label for the welcome embed
const LABEL_MAP: Record<string, string> = {
  role_builder: '🔧 Builder',
  role_gamer:   '🎮 Gamer',
  role_both:    '⚡ Builder & Gamer',
};

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (!interaction.isButton()) return;
  if (!(interaction.customId in ROLE_MAP)) return;

  const member = interaction.member as GuildMember;
  const roleKeys = ROLE_MAP[interaction.customId];
  const label = LABEL_MAP[interaction.customId];

  try {
    // Assign all applicable roles
    for (const key of roleKeys) {
      const roleId = config.roles[key];
      if (roleId && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId);
      }
    }

    // Update the DM — disable buttons and confirm
    await interaction.update({
      content: `You're in as **${label}**. Head to the server and make yourself at home. 🚀`,
      embeds: [],
      components: [],
    });

    console.log(`✅ Assigned roles [${roleKeys.join(', ')}] to ${member.user.tag}`);

    // Post welcome embed in #welcome
    const guild = interaction.guild;
    if (!guild) return;

    const welcomeChannel = guild.channels.cache.get(
      config.welcomeChannelId
    ) as TextChannel | undefined;

    if (!welcomeChannel?.isTextBased()) {
      console.warn('⚠️  Welcome channel not found or not a text channel.');
      return;
    }

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('New member just landed! 🛬')
      .setDescription(`Say hello to <@${member.id}>!`)
      .addFields({ name: 'Joined as', value: label, inline: true })
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp()
      .setFooter({ text: 'Archix Digital' });

    await welcomeChannel.send({ embeds: [welcomeEmbed] });
  } catch (err) {
    console.error('❌ Role assignment error:', err);

    // Reply ephemerally if something went wrong — don't leave them hanging
    if (interaction.replied || interaction.deferred) return;
    await interaction.reply({
      content:
        "Something went sideways assigning your roles. Drop a message in the server and we'll sort it out.",
      ephemeral: true,
    });
  }
}
