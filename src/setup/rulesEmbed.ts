import { Client, EmbedBuilder, TextChannel } from 'discord.js';

export function buildRulesEmbed(): EmbedBuilder[] {
  // ── Embed 1: Server Rules ─────────────────────────────────────────────────
  const rulesEmbed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('📜  Server Rules')
    .setDescription(
      'Archix is a space for builders and gamers to connect, collaborate, and grow. ' +
      'Keep it that way by following these rules. Violations may result in a warning, mute, or ban.\n\u200b'
    )
    .addFields(
      {
        name: '1 · Respect everyone',
        value: 'Treat all members with basic respect. Harassment, personal attacks, and targeted hate have no place here.',
        inline: false,
      },
      {
        name: '2 · No hate speech or discrimination',
        value: 'Content that demeans people based on race, gender, sexuality, religion, nationality, or disability is not allowed.',
        inline: false,
      },
      {
        name: '3 · No spam or excessive self-promo',
        value: 'Don\'t flood channels with repetitive messages, emoji walls, or unsolicited ads. Self-promo belongs in the designated channel.',
        inline: false,
      },
      {
        name: '4 · Keep content appropriate',
        value: 'NSFW content is strictly prohibited. Keep topics relevant to the channel you\'re posting in.',
        inline: false,
      },
      {
        name: '5 · No doxxing or sharing personal info',
        value: 'Never post someone\'s real name, address, phone number, or any identifying info without their consent.',
        inline: false,
      },
      {
        name: '6 · Follow Discord\'s Terms of Service',
        value: 'You must be 13+ to use Discord. All Discord ToS and Community Guidelines apply here.\ndiscord.com/terms  ·  discord.com/guidelines',
        inline: false,
      },
      {
        name: '7 · Listen to the moderation team',
        value: 'If a mod asks you to stop something, stop. If you disagree, resolve it in DMs — not publicly.',
        inline: false,
      },
    )
    .setFooter({ text: 'By being here, you agree to these rules.' });

  // ── Embed 2: Points & XP System ───────────────────────────────────────────
  const pointsEmbed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('💎  Points & XP System')
    .setDescription(
      'Everything you do in Archix earns XP. The more active you are, the higher you climb.\n\u200b'
    )
    .addFields(
      {
        name: '⚡ How to earn XP',
        value: [
          '`💬` **Send a message** — XP per message (cooldown applies)',
          '`🎙️` **Time in voice** — XP per minute in a voice channel',
          '`✅` **Complete quests** — bonus XP for specific challenges',
          '`👋` **Join the server** — +10 XP welcome bonus',
          '`🔥` **Daily streak** — log in and chat to keep your streak alive',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🏆 Tier ladder',
        value: [
          '⚪ **Member**  — 0 XP',
          '🔵 **Active**  — 100 XP',
          '🟢 **Regular** — 500 XP',
          '🟣 **Veteran** — 2,000 XP',
          '🟡 **Elite**   — 5,000 XP',
          '🔴 **Legend**  — 15,000 XP',
        ].join('\n'),
        inline: true,
      },
      {
        name: '📋 Useful commands',
        value: [
          '`/profile` — see your tier, XP, and streak',
          '`/points` — quick XP balance check',
          '`/leaderboard` — see who\'s on top',
          '`/quest list` — browse active quests',
        ].join('\n'),
        inline: true,
      },
      {
        name: '\u200b',
        value: 'XP is permanent — it never resets. Your tier reflects your total lifetime contribution.',
        inline: false,
      },
    )
    .setFooter({ text: 'Archix Digital  ·  grind smart' })
    .setTimestamp();

  return [rulesEmbed, pointsEmbed];
}

export async function postRulesEmbed(client: Client, channelId: string): Promise<void> {
  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) {
    console.error(`[Rules] Channel ${channelId} not found`);
    return;
  }

  const embeds = buildRulesEmbed();

  // Look for an existing rules post from the bot to edit instead of re-posting
  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = messages.find(
    m => m.author.id === client.user?.id && m.embeds[0]?.title?.includes('Server Rules')
  );

  if (existing) {
    await existing.edit({ embeds });
    console.log('[Rules] Updated existing rules embed');
  } else {
    await channel.send({ embeds });
    console.log('[Rules] Posted rules embed');
  }
}
