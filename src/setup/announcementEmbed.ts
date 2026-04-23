import { Client, EmbedBuilder, TextChannel } from 'discord.js';

export function buildAnnouncementEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('⚡  Archix — Updated')
    .setDescription(
      'This server just got even smarter.\n\n' +
      '**Archix** is a custom community intelligence system built from the ground up by **Valrok** — ' +
      'designed to turn passive server membership into an active, rewarding experience.'
    )
    .addFields(
      {
        name: '🧠 What Archix does',
        value: [
          '**Tracks everything** — messages, voice time, reactions, and daily streaks all count toward your XP',
          '**Ranks you automatically** — climb from Member all the way to Legend based on your total contribution',
          '**Runs quests** — daily challenges across 3 difficulty tiers with bonus XP and coin rewards',
          '**Shows live stats** — a real-time dashboard updates every 5 minutes with leaderboards and activity',
          '**Runs a server economy** — earn Coins just by being active, then spend or gamble them',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🏆 The tier ladder',
        value: '⚪ Member  →  🔵 Active  →  🟢 Regular  →  🟣 Veteran  →  🟡 Elite  →  🔴 Legend',
        inline: false,
      },
      {
        name: '🪙 The Coin economy',
        value: [
          'Coins are earned automatically — chat, hang in voice, complete quests, or claim your daily bonus',
          'Spend them in the shop, challenge others, or try your luck',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🚀 Commands',
        value: [
          '`/profile` — your tier, XP, streak, and coin balance',
          '`/leaderboard` — see who\'s running the server',
          '`/quest` — view today\'s daily quests',
          '`/balance` — check your Coins',
          '`/claim` — grab your daily Coin bonus',
          '`/shop` — browse items available for purchase',
          '`/coinflip` — bet Coins, 50/50',
          '`/slots` — spin the reels',
          '`/give` — send Coins to another member',
          '`/richest` — the top 10 coin holders',
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
