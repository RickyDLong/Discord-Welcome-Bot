import { Router } from 'express';
import { supabase } from '../../db/supabase';
import { config } from '../../config';

export const statsRouter = Router();
const G = config.GUILD_ID;

// GET /api/stats/overview
statsRouter.get('/overview', async (_req, res) => {
  const today = new Date().toISOString().split('T')[0]!;
  const [guildStats, voiceSessions, messages, recentJoins] = await Promise.all([
    supabase.from('guild_stats').select('member_count, online_count').eq('guild_id', G).single(),
    supabase.from('voice_sessions').select('duration_seconds').eq('guild_id', G).gte('started_at', today).not('duration_seconds', 'is', null),
    supabase.from('message_events').select('id', { count: 'exact', head: true }).eq('guild_id', G).gte('created_at', today),
    supabase.from('member_events').select('event_type, created_at').eq('guild_id', G).in('event_type', ['join','leave']).gte('created_at', today),
  ]);
  const totalVoiceSecs = (voiceSessions.data ?? []).reduce((a, r) => a + (r.duration_seconds ?? 0), 0);
  const joins  = (recentJoins.data ?? []).filter(r => r.event_type === 'join').length;
  const leaves = (recentJoins.data ?? []).filter(r => r.event_type === 'leave').length;
  res.json({
    members:         guildStats.data?.member_count ?? null,
    onlineCount:     guildStats.data?.online_count ?? null,
    voiceHoursToday: +(totalVoiceSecs / 3600).toFixed(1),
    messagesToday:   messages.count,
    joinsToday:      joins,
    leavesToday:     leaves,
  });
});

// GET /api/stats/leaderboard/points
statsRouter.get('/leaderboard/points', async (req, res) => {
  const limit = Math.min(parseInt(req.query['limit'] as string) || 10, 50);
  const { data } = await supabase.from('user_points').select('user_id, points, total_earned').eq('guild_id', G).order('total_earned', { ascending: false }).limit(limit);
  const profiles = await resolveProfiles((data ?? []).map(r => r.user_id as string));
  const enriched = (data ?? []).map(r => ({ ...r, display_name: profiles.get(r.user_id as string)?.name ?? `…${(r.user_id as string).slice(-4)}`, avatar_url: profiles.get(r.user_id as string)?.avatarUrl }));
  res.json(enriched);
});

// GET /api/stats/leaderboard/voice?period=today|week|all
statsRouter.get('/leaderboard/voice', async (req, res) => {
  const period = req.query['period'] as string ?? 'today';
  let since = new Date(0).toISOString();
  if (period === 'today') since = new Date().toISOString().split('T')[0]!;
  if (period === 'week')  since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase.from('voice_sessions').select('user_id, duration_seconds').eq('guild_id', G).gte('started_at', since).not('duration_seconds', 'is', null);
  const agg = new Map<string, number>();
  (data ?? []).forEach(r => agg.set(r.user_id, (agg.get(r.user_id) ?? 0) + r.duration_seconds));
  const sorted = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const profiles = await resolveProfiles(sorted.map(([uid]) => uid));
  res.json(sorted.map(([user_id, seconds]) => ({ user_id, seconds, display_name: profiles.get(user_id)?.name ?? `…${user_id.slice(-4)}`, avatar_url: profiles.get(user_id)?.avatarUrl })));
});

// GET /api/stats/leaderboard/messages?period=today|week|all
statsRouter.get('/leaderboard/messages', async (req, res) => {
  const period = req.query['period'] as string ?? 'today';
  let since = new Date(0).toISOString();
  if (period === 'today') since = new Date().toISOString().split('T')[0]!;
  if (period === 'week')  since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase.from('message_events').select('user_id').eq('guild_id', G).gte('created_at', since);
  const agg = new Map<string, number>();
  (data ?? []).forEach(r => agg.set(r.user_id, (agg.get(r.user_id) ?? 0) + 1));
  const sorted = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const profiles = await resolveProfiles(sorted.map(([uid]) => uid));
  res.json(sorted.map(([user_id, count]) => ({ user_id, count, display_name: profiles.get(user_id)?.name ?? `…${user_id.slice(-4)}`, avatar_url: profiles.get(user_id)?.avatarUrl })));
});

// GET /api/stats/leaderboard/streaks
statsRouter.get('/leaderboard/streaks', async (_req, res) => {
  const { data } = await supabase.from('daily_streaks').select('user_id, streak_count').eq('guild_id', G).order('streak_count', { ascending: false }).limit(10);
  const profiles = await resolveProfiles((data ?? []).map(r => r.user_id as string));
  const enriched = (data ?? []).map(r => ({ ...r, display_name: profiles.get(r.user_id as string)?.name ?? `…${(r.user_id as string).slice(-4)}`, avatar_url: profiles.get(r.user_id as string)?.avatarUrl }));
  res.json(enriched);
});

// GET /api/stats/voice/live
statsRouter.get('/voice/live', async (_req, res) => {
  const { data } = await supabase.from('voice_channel_snapshots').select('*').eq('guild_id', G).order('snapshot_at', { ascending: false }).limit(20);
  // Most recent snapshot per channel
  const latest = new Map<string, any>();
  (data ?? []).forEach(r => { if (!latest.has(r.channel_id)) latest.set(r.channel_id, r); });
  const channels = [...latest.values()];

  // Collect all unique user_ids across all channels
  const allUserIds = [...new Set(
    channels.flatMap(ch => ((ch.members as any[]) ?? []).map((m: any) => m.user_id as string))
  )];
  const profiles = await resolveProfiles(allUserIds);

  // Enrich each channel's members array with display_name + avatar_url
  const enriched = channels.map(ch => ({
    ...ch,
    members: ((ch.members as any[]) ?? []).map((m: any) => ({
      user_id:      m.user_id,
      display_name: profiles.get(m.user_id)?.name ?? m.username ?? `…${m.user_id.slice(-4)}`,
      avatar_url:   profiles.get(m.user_id)?.avatarUrl,
    })),
  }));

  res.json(enriched);
});

// GET /api/stats/members/timeline?days=30
statsRouter.get('/members/timeline', async (req, res) => {
  const days  = parseInt(req.query['days'] as string) || 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await supabase.from('member_events').select('event_type, created_at').eq('guild_id', G).in('event_type', ['join','leave']).gte('created_at', since).order('created_at');
  res.json(data ?? []);
});

// GET /api/stats/user/:userId
statsRouter.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const today = new Date().toISOString().split('T')[0]!;
  const [pts, streak, voice, msgs, quests] = await Promise.all([
    supabase.from('user_points').select('points, total_earned').eq('user_id', userId).eq('guild_id', G).single(),
    supabase.from('daily_streaks').select('streak_count, last_active_date').eq('user_id', userId).eq('guild_id', G).single(),
    supabase.from('voice_sessions').select('duration_seconds').eq('user_id', userId).eq('guild_id', G).gte('started_at', today).not('duration_seconds', 'is', null),
    supabase.from('message_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('guild_id', G).gte('created_at', today),
    supabase.from('quest_submissions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('guild_id', G).eq('status', 'approved'),
  ]);
  const voiceSecs = (voice.data ?? []).reduce((a, r) => a + (r.duration_seconds ?? 0), 0);
  res.json({ points: pts.data?.points ?? 0, total_earned: pts.data?.total_earned ?? 0, streak: streak.data?.streak_count ?? 0, voice_seconds_today: voiceSecs, messages_today: msgs.count ?? 0, quests_completed: quests.count ?? 0 });
});

// GET /api/stats/quests/today
statsRouter.get('/quests/today', async (_req, res) => {
  const today = new Date().toISOString().split('T')[0]!;
  const [quests, progress] = await Promise.all([
    supabase.from('daily_quests').select('*').eq('guild_id', G).eq('quest_date', today).order('difficulty'),
    supabase.from('daily_quest_progress').select('user_id, quest_id, progress, completed').eq('guild_id', G).eq('quest_date', today).eq('completed', true),
  ]);
  const totalCompletions = progress.data?.length ?? 0;
  const uniqueCompleters = new Set(progress.data?.map(r => r.user_id)).size;
  const tripleThreat = Object.entries(
    (progress.data ?? []).reduce((acc: Record<string, number>, r) => {
      acc[r.user_id] = (acc[r.user_id] ?? 0) + 1; return acc;
    }, {}),
  ).filter(([, c]) => c >= 3).map(([uid]) => uid);
  res.json({ quests: quests.data ?? [], totalCompletions, uniqueCompleters, tripleThreat });
});

// Helper: build Discord CDN avatar URL
function buildAvatarUrl(userId: string, avatarHash: string | null): string {
  if (!avatarHash) {
    const index = Number(BigInt(userId) >> 22n) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`;
}

interface UserProfile { name: string; avatarUrl: string }

// Helper: resolve display names + avatars for a list of user_ids
async function resolveProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase.from('user_profiles').select('user_id, display_name, username, avatar_hash').eq('guild_id', G).in('user_id', userIds);
  return new Map((data ?? []).map(p => [p.user_id, {
    name:      p.display_name ?? p.username ?? `…${p.user_id.slice(-4)}`,
    avatarUrl: buildAvatarUrl(p.user_id as string, p.avatar_hash as string | null),
  }]));
}

// Convenience wrapper for callers that only need the name
async function resolveNames(userIds: string[]): Promise<Map<string, string>> {
  const profiles = await resolveProfiles(userIds);
  return new Map([...profiles.entries()].map(([id, p]) => [id, p.name]));
}

// GET /api/stats/achievements/recent?limit=10
statsRouter.get('/achievements/recent', async (req, res) => {
  const limit = Math.min(parseInt(req.query['limit'] as string) || 10, 50);
  const { data } = await supabase
    .from('user_achievements')
    .select('user_id, achievement_id, earned_at, achievement_definitions(name, description, emoji, xp_reward)')
    .eq('guild_id', G)
    .order('earned_at', { ascending: false })
    .limit(limit);
  const profiles = await resolveProfiles([...new Set((data ?? []).map(r => r.user_id as string))]);
  const enriched = (data ?? []).map(r => ({ ...r, display_name: profiles.get(r.user_id as string)?.name ?? `…${(r.user_id as string).slice(-4)}`, avatar_url: profiles.get(r.user_id as string)?.avatarUrl }));
  res.json(enriched);
});

// GET /api/stats/achievements/leaderboard — users ranked by achievement XP
statsRouter.get('/achievements/leaderboard', async (_req, res) => {
  const { data } = await supabase
    .from('user_achievements')
    .select('user_id, achievement_definitions(xp_reward)')
    .eq('guild_id', G);
  const totals = new Map<string, number>();
  (data ?? []).forEach(r => {
    const xp = (r.achievement_definitions as any)?.xp_reward ?? 0;
    totals.set(r.user_id as string, (totals.get(r.user_id as string) ?? 0) + xp);
  });
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const profiles = await resolveProfiles(sorted.map(([uid]) => uid));
  res.json(sorted.map(([user_id, xp]) => ({ user_id, achievement_xp: xp, display_name: profiles.get(user_id)?.name ?? `…${user_id.slice(-4)}`, avatar_url: profiles.get(user_id)?.avatarUrl })));
});

// GET /api/stats/leaderboard/reactions?period=today|week|all
statsRouter.get('/leaderboard/reactions', async (req, res) => {
  const period = req.query['period'] as string ?? 'today';
  let since = new Date(0).toISOString();
  if (period === 'today') since = new Date().toISOString().split('T')[0]!;
  if (period === 'week')  since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase.from('reaction_events').select('user_id').eq('guild_id', G).eq('event_type', 'add').gte('created_at', since);
  const agg = new Map<string, number>();
  (data ?? []).forEach(r => agg.set(r.user_id as string, (agg.get(r.user_id as string) ?? 0) + 1));
  const sorted = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const profiles = await resolveProfiles(sorted.map(([uid]) => uid));
  res.json(sorted.map(([user_id, count]) => ({ user_id, count, display_name: profiles.get(user_id)?.name ?? `…${user_id.slice(-4)}`, avatar_url: profiles.get(user_id)?.avatarUrl })));
});

// GET /api/stats/tiers/distribution
statsRouter.get('/tiers/distribution', async (_req, res) => {
  const { data } = await supabase.from('user_points').select('total_earned').eq('guild_id', G);
  const buckets: Record<string, number> = { Member: 0, Active: 0, Regular: 0, Veteran: 0, Elite: 0, Legend: 0 };
  (data ?? []).forEach(r => {
    const pts = (r.total_earned as number) ?? 0;
    if (pts >= 15000)     buckets['Legend']!++;
    else if (pts >= 5000) buckets['Elite']!++;
    else if (pts >= 2000) buckets['Veteran']!++;
    else if (pts >= 500)  buckets['Regular']!++;
    else if (pts >= 100)  buckets['Active']!++;
    else                  buckets['Member']!++;
  });
  res.json(buckets);
});

// GET /api/stats/activity/score — today's composite activity score
statsRouter.get('/activity/score', async (_req, res) => {
  const today = new Date().toISOString().split('T')[0]!;
  const [msgs, voice, rxn, quests] = await Promise.all([
    supabase.from('message_events').select('id', { count: 'exact', head: true }).eq('guild_id', G).gte('created_at', today),
    supabase.from('voice_sessions').select('duration_seconds').eq('guild_id', G).gte('started_at', today).not('duration_seconds', 'is', null),
    supabase.from('reaction_events').select('id', { count: 'exact', head: true }).eq('guild_id', G).eq('event_type', 'add').gte('created_at', today),
    supabase.from('daily_quest_progress').select('id', { count: 'exact', head: true }).eq('guild_id', G).eq('quest_date', today).eq('completed', true),
  ]);
  const voiceMins = (voice.data ?? []).reduce((a, r) => a + ((r.duration_seconds as number) ?? 0), 0) / 60;
  const score = Math.round((msgs.count ?? 0) * 1 + voiceMins * 2 + (rxn.count ?? 0) * 0.5 + (quests.count ?? 0) * 10);
  res.json({ score, breakdown: { messages: msgs.count ?? 0, voice_minutes: Math.round(voiceMins), reactions: rxn.count ?? 0, quests_completed: quests.count ?? 0 } });
});

// GET /api/stats/members — all known members with profiles + current stats
statsRouter.get('/members', async (_req, res) => {
  const [profilesRes, pointsRes, streaksRes] = await Promise.all([
    supabase.from('user_profiles').select('user_id, display_name, username, avatar_hash').eq('guild_id', G),
    supabase.from('user_points').select('user_id, total_earned, points').eq('guild_id', G),
    supabase.from('daily_streaks').select('user_id, streak_count').eq('guild_id', G),
  ]);
  const pointsMap  = new Map((pointsRes.data ?? []).map(p => [p.user_id as string, p]));
  const streakMap  = new Map((streaksRes.data ?? []).map(s => [s.user_id as string, s.streak_count as number]));
  const members = (profilesRes.data ?? []).map(p => ({
    user_id:      p.user_id,
    display_name: p.display_name ?? p.username ?? `…${(p.user_id as string).slice(-4)}`,
    avatar_url:   buildAvatarUrl(p.user_id as string, p.avatar_hash as string | null),
    total_earned: pointsMap.get(p.user_id as string)?.total_earned ?? 0,
    points:       pointsMap.get(p.user_id as string)?.points ?? 0,
    streak:       streakMap.get(p.user_id as string) ?? 0,
  })).sort((a, b) => (b.total_earned as number) - (a.total_earned as number));
  res.json(members);
});

// GET /api/stats/activity/heatmap?userId=xxx
statsRouter.get('/activity/heatmap', async (req, res) => {
  const userId = req.query['userId'] as string;
  const since  = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const query  = supabase.from('message_events').select('created_at').eq('guild_id', G).gte('created_at', since);
  if (userId) query.eq('user_id', userId);
  const { data } = await query;
  const counts = new Map<string, number>();
  (data ?? []).forEach(r => {
    const day = r.created_at.split('T')[0]!;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  });
  res.json(Object.fromEntries(counts));
});

// GET /api/stats/economy/leaderboard — richest members with avatars
statsRouter.get('/economy/leaderboard', async (_req, res) => {
  const { data } = await supabase
    .from('server_economy')
    .select('user_id, balance, total_earned, total_spent')
    .eq('guild_id', G)
    .order('balance', { ascending: false })
    .limit(10);
  const profiles = await resolveProfiles((data ?? []).map(r => r.user_id as string));
  const enriched = (data ?? []).map(r => ({
    ...r,
    display_name: profiles.get(r.user_id as string)?.name ?? `…${(r.user_id as string).slice(-4)}`,
    avatar_url:   profiles.get(r.user_id as string)?.avatarUrl,
  }));
  res.json(enriched);
});

// GET /api/stats/economy/overview — totals for dashboard stats
statsRouter.get('/economy/overview', async (_req, res) => {
  const [totals, txCount] = await Promise.all([
    supabase.from('server_economy').select('balance, total_earned, total_spent').eq('guild_id', G),
    supabase.from('economy_transactions').select('id', { count: 'exact', head: true }).eq('guild_id', G),
  ]);
  const rows = totals.data ?? [];
  const totalSupply  = rows.reduce((a, r) => a + (r.balance as number), 0);
  const totalEarned  = rows.reduce((a, r) => a + (r.total_earned as number), 0);
  const totalSpent   = rows.reduce((a, r) => a + (r.total_spent as number), 0);
  res.json({ totalSupply, totalEarned, totalSpent, totalTransactions: txCount.count ?? 0, activeUsers: rows.length });
});
