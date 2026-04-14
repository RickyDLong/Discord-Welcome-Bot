import { Client, EmbedBuilder, TextChannel } from 'discord.js';

export function buildAnnouncementEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('⚡  Introducing Archix')
    .setDescription(
      'This server just got a whole lot smarter.\n\n' +
      '**Archix** is a custom community intelligence system built from the ground up by **Valrok** — ' +
      'designed to turn passive server membership into an active, rewarding experience.'
    )
    .addFields(
      {
        name: '🧠 What Archix does',
        value: [
          '**Tracks everything** — messages, voice time, reactions, and daily streaks all count toward your XP',
          '**Ranks you automatically** — climb from Member all the way to Legend based on your total contribution',
          '**Runs quests** — special challenges posted by admins with bonus XP rewards',
          '**Shows live stats** — a real-time dashboard updates every 5 minutes with leaderboards and activity',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🏆 The tier ladder',
        value: '⚪ Member  →  🔵 Active  →  🟢 Regular  →  🟣 Veteran  →  🟡 Elite  →  🔴 Legend',
        inline: false,
      },
      {
        name: '🚀 How to get started',
        value: [
          '`/profile` — see your current tier, XP, streak, and stats',
          '`/leaderboard` — see who\'s running the server',
          '`/quest list` — find active quests to earn bonus XP',
          '`/points` — quick balance check',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📊 Live dashboard',
        value: '[View real-time server stats → archix-stats.vercel.app](https://archix-stats.vercel.app)',
        inline: false,
      },
    )
    .setFooter({ text: 'Built by Valrok  ·  Archix Digital' })
    .setTimestamp();
}

export async function postAnnouncementEmbed(client: Client, channelId: string): Promise<void> {
  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) {
    console.error(`[Announcement] Channel ${channelId} not found`);
    return;
  }

  const embed = buildAnnouncementEmbed();
  await channel.send({ embeds: [embed] });
  console.log('[Announcement] Posted Archix intro announcement');
}
