import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import {
  getBalance, addCoins, deductCoins, transferCoins,
  claimDaily, DAILY_AMOUNT,
  COINS_PER_QUEST,
} from '../economy/engine';
import { supabase } from '../db/supabase';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString(); }
function coinEmoji(n: number) {
  if (n >= 10000) return '💎';
  if (n >= 1000)  return '🥇';
  if (n >= 500)   return '🥈';
  return '🪙';
}
function msToHuman(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── /balance ─────────────────────────────────────────────────────────────────
export async function handleBalance(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const guildId = interaction.guildId!;
  const bal = await getBalance(guildId, target.id);
  const emoji = coinEmoji(bal.balance);

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`${emoji} ${target.displayName}'s Wallet`)
    .addFields(
      { name: '💰 Balance',      value: `**${fmt(bal.balance)} coins**`,      inline: true },
      { name: '📈 Total Earned', value: `${fmt(bal.total_earned)} coins`,      inline: true },
      { name: '🛍️ Total Spent',  value: `${fmt(bal.total_spent)} coins`,       inline: true },
    )
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: target.id !== interaction.user.id });
}

// ── /daily ───────────────────────────────────────────────────────────────────
export async function handleDaily(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const userId  = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  const result = await claimDaily(guildId, userId);

  if (!result.success) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('⏰ Already Claimed')
      .setDescription(`You can claim again in **${msToHuman(result.msRemaining!)}**.`);
    return interaction.editReply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('🎁 Daily Coins Claimed!')
    .setDescription(`You received **${fmt(DAILY_AMOUNT)} coins**!`)
    .addFields({ name: '💰 New Balance', value: `${fmt(result.newBalance!)} coins`, inline: true })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── /give ────────────────────────────────────────────────────────────────────
export async function handleGive(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);
  const guildId = interaction.guildId!;

  if (amount <= 0) return interaction.reply({ content: '❌ Amount must be positive.', ephemeral: true });
  if (target.bot)  return interaction.reply({ content: '❌ Cannot give coins to a bot.', ephemeral: true });
  if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Cannot give coins to yourself.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  try {
    await transferCoins(guildId, interaction.user.id, target.id, amount);
    const newBal = await getBalance(guildId, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('💸 Coins Sent!')
      .setDescription(`You sent **${fmt(amount)} coins** to ${target.displayName}.`)
      .addFields({ name: '💰 Your New Balance', value: `${fmt(newBal.balance)} coins`, inline: true })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (e: any) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('❌ Insufficient Balance')
      .setDescription(`You don't have enough coins to send **${fmt(amount)}**.`);
    await interaction.editReply({ embeds: [embed] });
  }
}

// ── /coinflip ────────────────────────────────────────────────────────────────
export async function handleCoinflip(interaction: ChatInputCommandInteraction) {
  const bet     = interaction.options.getInteger('amount', true);
  const guildId = interaction.guildId!;
  const userId  = interaction.user.id;

  if (bet < 10) return interaction.reply({ content: '❌ Minimum bet is **10 coins**.', ephemeral: true });

  await interaction.deferReply();

  const bal = await getBalance(guildId, userId);
  if (bal.balance < bet) {
    return interaction.editReply({ content: `❌ You only have **${fmt(bal.balance)} coins**.` });
  }

  const win   = Math.random() < 0.5;
  const side  = Math.random() < 0.5 ? '🦅 Heads' : '🦁 Tails';
  const payout = win ? bet : 0;

  try {
    let newBalance: number;
    if (win) {
      newBalance = await addCoins(guildId, userId, bet, 'coinflip', { bet, result: 'win' });
    } else {
      newBalance = await deductCoins(guildId, userId, bet, 'coinflip', { bet, result: 'loss' });
    }

    const embed = new EmbedBuilder()
      .setColor(win ? 0x10b981 : 0xef4444)
      .setTitle(win ? `🎉 You Won! ${side}` : `💀 You Lost! ${side}`)
      .addFields(
        { name: win ? '💰 Won' : '💸 Lost', value: `${fmt(bet)} coins`, inline: true },
        { name: '💳 Balance',               value: `${fmt(newBalance)} coins`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({ content: '❌ Something went wrong. Try again.' });
  }
}

// ── /slots ───────────────────────────────────────────────────────────────────
const REELS   = ['🍎','🍊','🍋','🍇','💎','🎰'];
const JACKPOT = '🎰';

function spinReels() { return Array.from({ length: 3 }, () => REELS[Math.floor(Math.random() * REELS.length)]!); }
function getMultiplier(reels: string[]) {
  if (reels.every(r => r === JACKPOT)) return 50;  // Triple 🎰 = jackpot
  if (reels[0] === reels[1] && reels[1] === reels[2]) return 10;  // Triple match
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) return 2;  // Pair
  return 0;
}

export async function handleSlots(interaction: ChatInputCommandInteraction) {
  const bet     = interaction.options.getInteger('amount', true);
  const guildId = interaction.guildId!;
  const userId  = interaction.user.id;

  if (bet < 10) return interaction.reply({ content: '❌ Minimum bet is **10 coins**.', ephemeral: true });

  await interaction.deferReply();

  const bal = await getBalance(guildId, userId);
  if (bal.balance < bet) {
    return interaction.editReply({ content: `❌ You only have **${fmt(bal.balance)} coins**.` });
  }

  const reels      = spinReels();
  const multiplier = getMultiplier(reels);
  const win        = multiplier > 0;
  const payout     = win ? bet * multiplier : 0;

  try {
    let newBalance: number;
    if (win) {
      // Net gain: payout minus original bet
      newBalance = await addCoins(guildId, userId, payout - bet, 'slots', { bet, multiplier, result: 'win' });
    } else {
      newBalance = await deductCoins(guildId, userId, bet, 'slots', { bet, multiplier: 0, result: 'loss' });
    }

    const reelDisplay = reels.join('  ');
    const isJackpot   = multiplier === 50;

    const embed = new EmbedBuilder()
      .setColor(isJackpot ? 0xf59e0b : win ? 0x10b981 : 0xef4444)
      .setTitle(isJackpot ? '🎰 JACKPOT!!' : win ? '🎉 Winner!' : '💀 No match')
      .setDescription(`\`\`\`\n[ ${reelDisplay} ]\n\`\`\``)
      .addFields(
        { name: 'Bet',      value: `${fmt(bet)} coins`,       inline: true },
        { name: 'Payout',   value: win ? `${multiplier}x = ${fmt(payout)} coins` : 'None', inline: true },
        { name: 'Balance',  value: `${fmt(newBalance)} coins`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({ content: '❌ Something went wrong. Try again.' });
  }
}

// ── /richest ─────────────────────────────────────────────────────────────────
export async function handleRichest(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  await interaction.deferReply();

  const { data } = await supabase
    .from('server_economy')
    .select('user_id, balance, total_earned')
    .eq('guild_id', guildId)
    .order('balance', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    return interaction.editReply({ content: '📭 No economy data yet.' });
  }

  const medals = ['🥇','🥈','🥉'];
  const lines = data.map((r, i) => {
    const medal = medals[i] ?? `**#${i + 1}**`;
    return `${medal} <@${r.user_id}> — **${fmt(r.balance)}** 🪙`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('💰 Richest Members')
    .setDescription(lines.join('\n'))
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── /shop ────────────────────────────────────────────────────────────────────
export async function handleShop(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  await interaction.deferReply({ ephemeral: true });

  const { data: items } = await supabase
    .from('shop_items')
    .select('*')
    .eq('guild_id', guildId)
    .eq('enabled', true)
    .order('price');

  if (!items || items.length === 0) {
    return interaction.editReply({ content: '🏪 The shop is empty. Admins can add items with `/additem`.' });
  }

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle('🏪 Server Shop')
    .setDescription('Use `/buy <item name>` to purchase.\n\u200b')
    .setTimestamp();

  for (const item of items) {
    const stockLabel = item.stock === null ? 'Unlimited' : `${item.stock} left`;
    const typeLabel  = item.type === 'role' ? '🎭 Role' : '✨ Cosmetic';
    embed.addFields({
      name:   `${item.name} — ${fmt(item.price)} 🪙`,
      value:  `${item.description ?? 'No description'}\n${typeLabel} · ${stockLabel}`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

// ── /buy ─────────────────────────────────────────────────────────────────────
export async function handleBuy(interaction: ChatInputCommandInteraction) {
  const itemName = interaction.options.getString('item', true);
  const guildId  = interaction.guildId!;
  const userId   = interaction.user.id;
  const member   = interaction.member as GuildMember;

  await interaction.deferReply({ ephemeral: true });

  const { data: item } = await supabase
    .from('shop_items')
    .select('*')
    .eq('guild_id', guildId)
    .ilike('name', itemName)
    .eq('enabled', true)
    .maybeSingle();

  if (!item) {
    return interaction.editReply({ content: `❌ Item **"${itemName}"** not found in the shop.` });
  }

  if (item.stock !== null && item.stock <= 0) {
    return interaction.editReply({ content: `❌ **${item.name}** is out of stock.` });
  }

  try {
    await deductCoins(guildId, userId, item.price, 'shop', { item_id: item.id, item_name: item.name });

    // Log purchase
    await supabase.from('shop_purchases').insert({
      guild_id:  guildId,
      user_id:   userId,
      item_id:   item.id,
      price_paid: item.price,
    });

    // Decrement stock if limited
    if (item.stock !== null) {
      await supabase.from('shop_items').update({ stock: item.stock - 1 }).eq('id', item.id);
    }

    // Auto-assign role if applicable
    if (item.type === 'role' && item.role_id && member) {
      try {
        await member.roles.add(item.role_id);
      } catch {
        console.warn(`[Shop] Could not assign role ${item.role_id} to ${userId}`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('✅ Purchase Successful!')
      .setDescription(`You bought **${item.name}** for ${fmt(item.price)} coins.`)
      .setTimestamp();

    if (item.type === 'role' && item.role_id) {
      embed.addFields({ name: '🎭 Role Assigned', value: `<@&${item.role_id}>`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (e: any) {
    if (e.message === 'Insufficient balance') {
      const bal = await getBalance(guildId, userId);
      return interaction.editReply({
        content: `❌ You need **${fmt(item.price)} coins** but only have **${fmt(bal.balance)}**.`,
      });
    }
    await interaction.editReply({ content: '❌ Purchase failed. Try again.' });
  }
}

// ── /additem (admin) ──────────────────────────────────────────────────────────
export async function handleAddItem(interaction: ChatInputCommandInteraction) {
  const guildId    = interaction.guildId!;
  const name       = interaction.options.getString('name', true);
  const price      = interaction.options.getInteger('price', true);
  const desc       = interaction.options.getString('description') ?? '';
  const role       = interaction.options.getRole('role');
  const stock      = interaction.options.getInteger('stock');

  await interaction.deferReply({ ephemeral: true });

  const { error } = await supabase.from('shop_items').insert({
    guild_id:    guildId,
    name,
    description: desc,
    price,
    type:        role ? 'role' : 'cosmetic',
    role_id:     role?.id ?? null,
    stock:       stock ?? null,
  });

  if (error?.code === '23505') {
    return interaction.editReply({ content: `❌ An item named **"${name}"** already exists.` });
  }
  if (error) {
    return interaction.editReply({ content: `❌ Failed to add item: ${error.message}` });
  }

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('✅ Item Added to Shop')
    .addFields(
      { name: 'Name',  value: name,                                 inline: true },
      { name: 'Price', value: `${fmt(price)} coins`,                inline: true },
      { name: 'Type',  value: role ? `🎭 Role (<@&${role.id}>)` : '✨ Cosmetic', inline: true },
      { name: 'Stock', value: stock !== null ? `${stock}` : 'Unlimited', inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── /removeitem (admin) ───────────────────────────────────────────────────────
export async function handleRemoveItem(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const name    = interaction.options.getString('name', true);

  await interaction.deferReply({ ephemeral: true });

  const { data: item } = await supabase
    .from('shop_items')
    .select('id, name')
    .eq('guild_id', guildId)
    .ilike('name', name)
    .maybeSingle();

  if (!item) {
    return interaction.editReply({ content: `❌ No item named **"${name}"** found.` });
  }

  await supabase.from('shop_items').update({ enabled: false }).eq('id', item.id);

  await interaction.editReply({ content: `✅ **${item.name}** has been removed from the shop.` });
}

// ── Slash command definitions ─────────────────────────────────────────────────
export const economyCommands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your coin balance')
    .addUserOption(o => o.setName('user').setDescription('Check another member\'s balance')),

  new SlashCommandBuilder()
    .setName('claim')
    .setDescription(`Claim your daily ${DAILY_AMOUNT} coins (24h cooldown)`),

  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Send coins to another member')
    .addUserOption(o => o.setName('user').setDescription('Who to send coins to').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('How many coins').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Bet coins on a 50/50 flip — win 2x or lose it all')
    .addIntegerOption(o => o.setName('amount').setDescription('Coins to bet (min 10)').setRequired(true).setMinValue(10)),

  new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Spin the slot machine — match 2 for 2x, match 3 for 10x, jackpot for 50x')
    .addIntegerOption(o => o.setName('amount').setDescription('Coins to bet (min 10)').setRequired(true).setMinValue(10)),

  new SlashCommandBuilder()
    .setName('richest')
    .setDescription('See the top 10 richest members'),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse items available in the server shop'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Purchase an item from the shop')
    .addStringOption(o => o.setName('item').setDescription('Name of the item to buy').setRequired(true)),

  new SlashCommandBuilder()
    .setName('additem')
    .setDescription('Add an item to the shop (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('name').setDescription('Item name').setRequired(true))
    .addIntegerOption(o => o.setName('price').setDescription('Cost in coins').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('description').setDescription('Item description'))
    .addRoleOption(o => o.setName('role').setDescription('Discord role to auto-assign on purchase'))
    .addIntegerOption(o => o.setName('stock').setDescription('Stock limit (leave blank for unlimited)').setMinValue(1)),

  new SlashCommandBuilder()
    .setName('removeitem')
    .setDescription('Remove an item from the shop (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('name').setDescription('Name of the item to remove').setRequired(true)),
].map(c => c.toJSON());
