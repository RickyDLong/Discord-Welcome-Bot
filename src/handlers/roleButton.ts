import { ButtonInteraction } from 'discord.js';
import { config } from '../config';

export async function handleRoleButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.member;
  if (!member || !('roles' in member)) {
    await interaction.editReply('Could not find your member data. Try again in the server.');
    return;
  }
  const roleId = interaction.customId === 'role_builder' ? config.ROLE_BUILDER : config.ROLE_GAMER;
  const roleName = interaction.customId === 'role_builder' ? 'Builder' : 'Gamer';
  try {
    await (member as any).roles.add(roleId);
    await interaction.editReply(`✅ You've been given the **${roleName}** role! Welcome to Archix Digital.`);
  } catch {
    await interaction.editReply('❌ Failed to assign role. Please contact a moderator.');
  }
}
