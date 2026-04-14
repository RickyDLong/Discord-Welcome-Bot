import { Client, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../config';

const commands = [
  new SlashCommandBuilder()
    .setName('points')
    .setDescription('Check your current point balance'),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your full Archix profile — tier, points, streak, and stats'),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top members on the server')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Leaderboard type')
        .addChoices(
          { name: 'Points (all time)', value: 'points' },
          { name: 'Voice time (today)', value: 'voice_today' },
          { name: 'Messages (today)',   value: 'messages_today' },
          { name: 'Streak',            value: 'streak' },
        )),

  new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Quest system')
    .addSubcommand(sub => sub.setName('list').setDescription('View active quests'))
    .addSubcommand(sub =>
      sub.setName('submit')
        .setDescription('Submit a quest completion')
        .addStringOption(opt => opt.setName('quest_id').setDescription('Quest ID').setRequired(true))
        .addStringOption(opt => opt.setName('proof').setDescription('Proof of completion (link or description)').setRequired(true)),
    ),

  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin commands')
    .setDefaultMemberPermissions(8) // Administrator only
    .addSubcommand(sub =>
      sub.setName('quest_create')
        .setDescription('Create a new quest')
        .addStringOption(opt => opt.setName('title').setDescription('Quest title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('What members need to do').setRequired(true))
        .addIntegerOption(opt => opt.setName('points').setDescription('Points reward').setRequired(true))
        .addIntegerOption(opt => opt.setName('max_completions').setDescription('Max times it can be completed (0 = unlimited)')),
    )
    .addSubcommand(sub =>
      sub.setName('quest_approve')
        .setDescription('Approve a quest submission')
        .addStringOption(opt => opt.setName('submission_id').setDescription('Submission ID').setRequired(true)),
    )
    .addSubcommand(sub =>
      sub.setName('award')
        .setDescription('Manually award points to a member')
        .addUserOption(opt => opt.setName('user').setDescription('Member').setRequired(true))
        .addIntegerOption(opt => opt.setName('points').setDescription('Points to award').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason')),
    )
    .addSubcommand(sub =>
      sub.setName('update_dashboard')
        .setDescription('Force refresh the stats dashboard'),
    )
    .addSubcommand(sub =>
      sub.setName('post_rules')
        .setDescription('Post (or refresh) the rules embed in a channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post rules in (defaults to current channel)'),
        ),
    ),
].map(cmd => cmd.toJSON());

export async function registerSlashCommands(client: Client): Promise<void> {
  if (!client.user) return;
  const rest = new REST().setToken(config.BOT_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, config.GUILD_ID),
    { body: commands },
  );
  console.log(`✅ Registered ${commands.length} slash commands.`);
}
