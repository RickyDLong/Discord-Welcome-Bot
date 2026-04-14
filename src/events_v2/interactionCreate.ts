import { Interaction } from 'discord.js';
import { handleRoleButton } from '../handlers/roleButton';
import { handleSlashCommand } from '../handlers/slashCommand';

export async function handleInteractionCreate(interaction: Interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleRoleButton(interaction);
    }
  } catch (e) {
    console.error('[InteractionCreate] Error:', e);
  }
}
