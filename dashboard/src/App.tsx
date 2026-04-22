import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const API = 'https://discord-welcome-bot-production-4559.up.railway.app'
const REFRESH_MS = 30_000

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface Overview {
  members: number | null
  onlineCount: number | null
  voiceHoursToday: number
  messagesToday: number | null
  joinsToday: number
  leavesToday: number
}
interface PointsEntry  { user_id: string; points: number; total_earned: number; display_name?: string; avatar_url?: string }
interface VoiceEntry   { user_id: string; seconds: number; display_name?: string; avatar_url?: string }
interface MsgEntry     { user_id: string; count: number; display_name?: string; avatar_url?: string }
interface StreakEntry   { user_id: string; streak_count: number; display_name?: string; avatar_url?: string }
interface VoiceMember  { user_id: string; display_name: string; avatar_url?: string }
interface VoiceLive    { channel_id: string; channel_name: string; member_count: number; snapshot_at: string; members?: VoiceMember[] }
interface MemberEvent  { event_type: 'join' | 'leave'; created_at: string }
interface ReactionEntry { user_id: string; count: number; display_name?: string; avatar_url?: string }
interface ActivityScore {
  score: number
  breakdown: { messages: number; voice_minutes: number; reactions: number; quests_completed: number }
}
interface TierDist { Member: number; Active: number; Regular: number; Veteran: number; Elite: number; Legend: number }
interface QuestDef { id: string; title: string; description: string; difficulty: string; xp_reward: number; quest_type: string; target_value: number }
interface QuestPulse { quests: QuestDef[]; totalCompletions: number; uniqueCompleters: number; tripleThreat: string[] }
interface AchievementEntry {
  user_id: string
  display_name?: string
  avatar_url?: string
  achievement_id: string
  earned_at: string
  achievement_definitions: { name: string; description: string; emoji: string; xp_reward: number } | null
}
interface AchievementXP { user_id: string; achievement_xp: number; display_name?: string; avatar_url?: string }
interface MemberEntry { user_id: string; display_name: string; avatar_url: string; total_earned: number; points: number; streak: number }
interface EconomyEntry { user_id: string; balance: number; total_earned: number; total_spent: number; display_name?: string; avatar_url?: string }
interface EconomyOverview { totalSupply: number; totalEarned: number; totalSpent: number; totalTransactions: number; activeUsers: number }
type Period = 'today' | 'week' | 'all'
type Section = 'overview' | 'leaderboards' | 'voice' | 'growth' | 'heatmap' | 'achievements' | 'members' | 'economy'

// ─── API HELPERS ─────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`)
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function fmtSecs(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function shortId(id: string) { return id.slice(-4) }
function medal(i: number) { return ['🥇','🥈','🥉'][i] ?? `#${i+1}` }

// ─── HOOKS ───────────────────────────────────────────────────────────────────
function useData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData]   = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setError(false)
      const d = await fetcher()
      setData(d)
    } catch { setError(true) }
    finally  { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load }
}

// ─── ATOMS ───────────────────────────────────────────────────────────────────
function Pulse({ color = 'var(--green)' }: { color?: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, animation: 'pulse 2s ease-in-out infinite',
      }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(2.2);opacity:0}}`}</style>
    </span>
  )
}

function Badge({ label, color = 'var(--primary)' }: { label: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 3,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      background: color + '22', color, border: `1px solid ${color}44`,
    }}>{label}</span>
  )
}

function Skeleton() {
  return (
    <div style={{
      height: 18, borderRadius: 4, background: 'var(--elevated)',
      animation: 'shimmer 1.4s ease-in-out infinite',
      backgroundImage: 'linear-gradient(90deg, var(--elevated) 0%, var(--border-hi) 50%, var(--elevated) 100%)',
      backgroundSize: '200% 100%',
    }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: 20, ...style,
    }}>{children}</div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        {title}
      </h2>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string | number; sub?: string; accent?: string; icon: string
}) {
  return (
    <Card style={{
      position: 'relative', overflow: 'hidden',
      borderColor: accent ? `${accent}33` : 'var(--border)',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${accent ?? 'var(--primary)'}18, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{
        fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1,
        color: accent ?? 'var(--text)', fontFamily: 'var(--mono)',
      }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}

// ─── TIER BADGE ──────────────────────────────────────────────────────────────
const TIER_CONFIG: { name: string; emoji: string; color: string }[] = [
  { name: 'Legend',  emoji: '🔴', color: '#e74c3c' },
  { name: 'Elite',   emoji: '🟡', color: '#f39c12' },
  { name: 'Veteran', emoji: '🟣', color: '#9b59b6' },
  { name: 'Regular', emoji: '🟢', color: '#2ecc71' },
  { name: 'Active',  emoji: '🔵', color: '#3498db' },
  { name: 'Member',  emoji: '⚪', color: '#95a5a6' },
]

function TierDistribution() {
  const { data, loading } = useData<TierDist>(() => apiFetch('/api/stats/tiers/distribution'))
  const total = data ? Object.values(data).reduce((a, b) => a + b, 0) : 0

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>📊</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Tier Distribution</span>
        {!loading && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{total} ranked</span>}
      </div>
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ marginBottom: 8 }}><Skeleton /></div>)
      ) : total === 0 ? (
        <p style={{ color: 'var(--text-3)', fontSize: 12 }}>No members ranked yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TIER_CONFIG.filter(t => (data?.[t.name as keyof TierDist] ?? 0) > 0).map(t => {
            const count = data?.[t.name as keyof TierDist] ?? 0
            const pct = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={t.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: t.color, fontWeight: 600 }}>{t.emoji} {t.name}</span>
                  <span style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{count}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--elevated)' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: t.color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function QuestPulseCard() {
  const { data, loading } = useData<QuestPulse>(() => apiFetch('/api/stats/quests/today'))

  const diffColor = (d: string) => ({ easy: 'var(--green)', medium: '#f59e0b', hard: '#ef4444' })[d] ?? 'var(--text-3)'

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Quest Pulse</span>
        {!loading && data && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
            {data.totalCompletions} completions
          </span>
        )}
      </div>
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ marginBottom: 8 }}><Skeleton /></div>)
      ) : !data || data.quests.length === 0 ? (
        <p style={{ color: 'var(--text-3)', fontSize: 12 }}>No quests today yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.quests.map(q => (
            <div key={q.id} style={{ padding: '8px 10px', background: 'var(--elevated)', borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{q.title}</span>
                <span style={{ fontSize: 10, color: diffColor(q.difficulty), fontWeight: 700, textTransform: 'uppercase' }}>{q.difficulty}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.description}</div>
              <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 3, fontFamily: 'var(--mono)' }}>+{q.xp_reward} XP</div>
            </div>
          ))}
          {data.uniqueCompleters > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-2)', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
              ✅ <strong>{data.uniqueCompleters}</strong> member{data.uniqueCompleters !== 1 ? 's' : ''} completed quests today
              {data.tripleThreat.length > 0 && <span style={{ color: '#f59e0b' }}> · 🎰 Triple Threat active</span>}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── OVERVIEW SECTION ────────────────────────────────────────────────────────
function Overview() {
  const { data, loading } = useData<Overview>(() => apiFetch('/api/stats/overview'))
  const { data: scoreData, loading: scoreLoading } = useData<ActivityScore>(() => apiFetch('/api/stats/activity/score'))

  const cards = [
    {
      label: 'Members',
      value: data?.members ?? '—',
      icon: '👥',
      accent: 'var(--primary)',
      sub: data?.onlineCount != null ? `🟢 ${data.onlineCount} online` : undefined,
    },
    {
      label: 'Voice Hours',
      value: data?.voiceHoursToday != null ? `${data.voiceHoursToday}h` : '—',
      icon: '🎙️',
      accent: 'var(--blue)',
    },
    {
      label: 'Messages Today',
      value: data?.messagesToday ?? '—',
      icon: '💬',
      accent: '#8b5cf6',
    },
    {
      label: 'Joins Today',
      value: data?.joinsToday ?? '—',
      icon: '✅',
      accent: 'var(--green)',
      sub: `${data?.leavesToday ?? 0} left`,
    },
    {
      label: 'Activity Score',
      value: scoreLoading ? '—' : (scoreData?.score ?? 0).toLocaleString(),
      icon: '⚡',
      accent: '#f59e0b',
      sub: scoreData ? `${scoreData.breakdown.voice_minutes}min voice · ${scoreData.breakdown.quests_completed} quests` : undefined,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Server Overview" sub="Live stats updated every 30s" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><Skeleton /></Card>
            ))
          : cards.map(c => (
              <StatCard key={c.label} {...c} />
            ))
        }
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <TierDistribution />
        <QuestPulseCard />
      </div>
    </div>
  )
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────
function Avatar({ url, name, size = 28 }: { url?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const cleaned = name.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]/g, '')
  const initials = cleaned.length >= 2 ? cleaned.slice(0, 2).toUpperCase() : cleaned.slice(0, 1).toUpperCase() || '?'
  if (!url || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `hsl(${hue},55%,32%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700, color: '#fff',
        border: '1.5px solid rgba(255,255,255,0.1)',
      }}>{initials}</div>
    )
  }
  return (
    <img src={url} alt={name} onError={() => setErr(true)} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.1)',
    }} />
  )
}

// ─── LEADERBOARD ROW ─────────────────────────────────────────────────────────
function LBRow({ rank, label, value, isFirst, avatarUrl }: { rank: number; label: string; value: string; isFirst: boolean; avatarUrl?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
      borderBottom: '1px solid var(--border)',
      background: isFirst ? 'var(--primary-lo)' : 'transparent',
      borderRadius: isFirst ? 6 : 0,
    }}>
      <span style={{
        width: 22, fontSize: isFirst ? 15 : 11,
        color: isFirst ? 'var(--gold)' : 'var(--text-3)',
        fontFamily: 'var(--mono)', fontWeight: 700, flexShrink: 0, textAlign: 'center',
      }}>{medal(rank)}</span>
      <Avatar url={avatarUrl} name={label} size={26} />
      <span style={{
        flex: 1, fontSize: 13, fontWeight: rank === 0 ? 600 : 400,
        color: rank === 0 ? 'var(--text)' : 'var(--text-2)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: rank === 0 ? 'var(--primary)' : 'var(--text-2)', fontWeight: 700 }}>
        {value}
      </span>
    </div>
  )
}

function LBCard({ title, icon, rows, loading, empty }: {
  title: string; icon: string; rows: { label: string; value: string; avatarUrl?: string }[]; loading: boolean; empty: string
}) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
      </div>
      {loading
        ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ marginBottom: 10 }}><Skeleton /></div>)
        : rows.length === 0
          ? <p style={{ color: 'var(--text-3)', fontSize: 12, padding: '12px 0' }}>{empty}</p>
          : rows.map((r, i) => (
              <LBRow key={i} rank={i} label={r.label} value={r.value} isFirst={i === 0} avatarUrl={r.avatarUrl} />
            ))
      }
    </Card>
  )
}

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts: Period[] = ['today', 'week', 'all']
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--elevated)', borderRadius: 6, padding: 3 }}>
      {opts.map(p => (
        <button key={p} onClick={() => onChange(p)} style={{
          padding: '4px 12px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600,
          background: value === p ? 'var(--primary)' : 'transparent',
          color: value === p ? '#fff' : 'var(--text-3)',
          transition: 'all 0.15s',
          textTransform: 'capitalize',
        }}>{p}</button>
      ))}
    </div>
  )
}

function Leaderboards() {
  const [period, setPeriod] = useState<Period>('today')

  const pts      = useData<PointsEntry[]>(() => apiFetch('/api/stats/leaderboard/points'))
  const voice    = useData<VoiceEntry[]>(() => apiFetch(`/api/stats/leaderboard/voice?period=${period}`), [period])
  const msgs     = useData<MsgEntry[]>(() => apiFetch(`/api/stats/leaderboard/messages?period=${period}`), [period])
  const streaks  = useData<StreakEntry[]>(() => apiFetch('/api/stats/leaderboard/streaks'))
  const rxn      = useData<ReactionEntry[]>(() => apiFetch(`/api/stats/leaderboard/reactions?period=${period}`), [period])
  const achXP    = useData<AchievementXP[]>(() => apiFetch('/api/stats/achievements/leaderboard'))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Leaderboards</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Top community contributors</p>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <LBCard
          title="All-Time XP" icon="🏆" loading={pts.loading} empty="No data yet"
          rows={(pts.data ?? []).slice(0,5).map(r => ({
            label: r.display_name ?? `…${r.user_id.slice(-4)}`,
            value: r.total_earned.toLocaleString(),
            avatarUrl: r.avatar_url,
          }))}
        />
        <LBCard
          title="Voice Time" icon="🎙️" loading={voice.loading} empty="No voice activity"
          rows={(voice.data ?? []).slice(0,5).map(r => ({
            label: r.display_name ?? `…${r.user_id.slice(-4)}`,
            value: fmtSecs(r.seconds),
            avatarUrl: r.avatar_url,
          }))}
        />
        <LBCard
          title="Messages" icon="💬" loading={msgs.loading} empty="No messages yet"
          rows={(msgs.data ?? []).slice(0,5).map(r => ({
            label: r.display_name ?? `…${r.user_id.slice(-4)}`,
            value: r.count.toLocaleString(),
            avatarUrl: r.avatar_url,
          }))}
        />
        <LBCard
          title="Reactions" icon="⚡" loading={rxn.loading} empty="No reactions yet"
          rows={(rxn.data ?? []).slice(0,5).map(r => ({
            label: r.display_name ?? `…${r.user_id.slice(-4)}`,
            value: r.count.toLocaleString(),
            avatarUrl: r.avatar_url,
          }))}
        />
        <LBCard
          title="Streaks" icon="🔥" loading={streaks.loading} empty="No streaks yet"
          rows={(streaks.data ?? []).slice(0,5).map(r => ({
            label: r.display_name ?? `…${r.user_id.slice(-4)}`,
            value: `${r.streak_count}d`,
            avatarUrl: r.avatar_url,
          }))}
        />
        <LBCard
          title="Achievement XP" icon="🏅" loading={achXP.loading} empty="No achievements yet"
          rows={(achXP.data ?? []).slice(0,5).map(r => ({
            label: r.display_name ?? `…${r.user_id.slice(-4)}`,
            value: r.achievement_xp.toLocaleString(),
            avatarUrl: r.avatar_url,
          }))}
        />
      </div>
    </div>
  )
}

// ─── LIVE VOICE ───────────────────────────────────────────────────────────────
function LiveVoice() {
  const { data, loading } = useData<VoiceLive[]>(() => apiFetch('/api/stats/voice/live'))

  const active = (data ?? []).filter(c => c.member_count > 0)

  return (
    <div>
      <SectionHeader title="Live Voice" sub="Current activity in voice channels" />
      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {Array.from({ length: 2 }).map((_, i) => <Card key={i}><Skeleton /></Card>)}
        </div>
      ) : active.length === 0 ? (
        <Card>
          <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            🔇 No one in voice right now
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {active.map(ch => (
            <Card key={ch.channel_id} style={{ borderColor: 'var(--green)33' }}>
              {/* Channel header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Pulse color="var(--green)" />
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
                  {ch.channel_name || `Channel ${shortId(ch.channel_id)}`}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                  color: 'var(--green)', background: 'var(--green)18',
                  padding: '2px 7px', borderRadius: 10,
                }}>
                  {ch.member_count} {ch.member_count === 1 ? 'member' : 'members'}
                </span>
              </div>
              {/* Member cards */}
              {(ch.members ?? []).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(ch.members ?? []).map(m => (
                    <div key={m.user_id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 10px', borderRadius: 6,
                      background: 'var(--elevated)',
                    }}>
                      <Avatar url={m.avatar_url} name={m.display_name} size={30} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.display_name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>
                    {ch.member_count}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {ch.member_count === 1 ? 'member' : 'members'}
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MEMBER GROWTH ───────────────────────────────────────────────────────────
function buildTimeline(events: MemberEvent[], days: number) {
  const map = new Map<string, { joins: number; leaves: number }>()
  const now = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000).toISOString().split('T')[0]!
    map.set(d, { joins: 0, leaves: 0 })
  }
  events.forEach(e => {
    const d = e.created_at.split('T')[0]!
    const entry = map.get(d)
    if (entry) {
      if (e.event_type === 'join') entry.joins++
      else entry.leaves++
    }
  })
  return [...map.entries()].map(([date, v]) => ({
    date: date.slice(5), // MM-DD
    joins: v.joins,
    leaves: v.leaves,
    net: v.joins - v.leaves,
  }))
}

function MemberGrowth() {
  const [days, setDays] = useState(30)
  const { data, loading } = useData<MemberEvent[]>(
    () => apiFetch(`/api/stats/members/timeline?days=${days}`),
    [days]
  )

  const chartData = data ? buildTimeline(data, days) : []
  const totalJoins  = chartData.reduce((a, d) => a + d.joins, 0)
  const totalLeaves = chartData.reduce((a, d) => a + d.leaves, 0)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'var(--elevated)', border: '1px solid var(--border-hi)',
        padding: '8px 12px', borderRadius: 6, fontSize: 12,
      }}>
        <p style={{ color: 'var(--text-2)', marginBottom: 6 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color, fontFamily: 'var(--mono)', fontWeight: 600 }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Member Growth</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            <span style={{ color: 'var(--green)', fontWeight: 600, marginRight: 12 }}>+{totalJoins} joined</span>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>−{totalLeaves} left</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--elevated)', borderRadius: 6, padding: 3 }}>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '4px 12px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600,
              background: days === d ? 'var(--primary)' : 'transparent',
              color: days === d ? '#fff' : 'var(--text-3)',
              transition: 'all 0.15s',
            }}>{d}d</button>
          ))}
        </div>
      </div>
      <Card>
        {loading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Skeleton />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gJoin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLeave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--red)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
                interval={days <= 7 ? 0 : Math.floor(days / 7)}
              />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="joins"  name="Joins"  stroke="var(--green)" fill="url(#gJoin)"  strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="leaves" name="Leaves" stroke="var(--red)"   fill="url(#gLeave)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}

// ─── ACTIVITY HEATMAP ────────────────────────────────────────────────────────
function ActivityHeatmap() {
  const { data, loading } = useData<Record<string, number>>(() => apiFetch('/api/stats/activity/heatmap'))

  const weeks = 26
  const days  = weeks * 7
  const today = new Date()
  const cells: { date: string; count: number; dow: number }[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000)
    const key = d.toISOString().split('T')[0]!
    cells.push({ date: key, count: data?.[key] ?? 0, dow: d.getDay() })
  }

  const maxCount = Math.max(...cells.map(c => c.count), 1)

  function cellColor(count: number) {
    if (count === 0) return 'var(--elevated)'
    const intensity = Math.min(count / maxCount, 1)
    if (intensity < 0.25) return '#4c1d95'
    if (intensity < 0.5)  return '#6d28d9'
    if (intensity < 0.75) return '#7c3aed'
    return '#8b5cf6'
  }

  // Group into columns (weeks)
  const grid: typeof cells[] = []
  for (let w = 0; w < weeks; w++) {
    grid.push(cells.slice(w * 7, w * 7 + 7))
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const totalMessages = Object.values(data ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Activity Heatmap</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {loading ? '—' : totalMessages.toLocaleString()} messages in the last 6 months
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
          <span>Less</span>
          {['var(--elevated)','#4c1d95','#6d28d9','#7c3aed','#8b5cf6'].map((c, i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <Card style={{ overflowX: 'auto' }}>
        {loading ? (
          <Skeleton />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 'max-content' }}>
            {/* Month labels */}
            <div style={{ display: 'flex', gap: 3, paddingLeft: 20 }}>
              {grid.map((week, wi) => {
                const firstDay = week[0]
                if (!firstDay) return <div key={wi} style={{ width: 11 }} />
                const d = new Date(firstDay.date)
                return d.getDate() <= 7 ? (
                  <div key={wi} style={{ width: 11, fontSize: 9, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                    {months[d.getMonth()]}
                  </div>
                ) : <div key={wi} style={{ width: 11 }} />
              })}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {/* Day labels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} style={{ width: 11, height: 11, fontSize: 9, color: i % 2 === 1 ? 'var(--text-3)' : 'transparent', lineHeight: '11px', textAlign: 'center' }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Grid */}
              {grid.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {Array.from({ length: 7 }).map((_, di) => {
                    const cell = week[di]
                    return (
                      <div
                        key={di}
                        title={cell ? `${cell.date}: ${cell.count} messages` : ''}
                        style={{
                          width: 11, height: 11, borderRadius: 2,
                          background: cell ? cellColor(cell.count) : 'var(--elevated)',
                          cursor: cell?.count ? 'pointer' : 'default',
                          transition: 'opacity 0.1s',
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
function Achievements() {
  const recent = useData<AchievementEntry[]>(() => apiFetch('/api/stats/achievements/recent?limit=20'))
  const top    = useData<AchievementXP[]>(() => apiFetch('/api/stats/achievements/leaderboard'))

  function timeAgo(iso: string) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 60) return `${mins}m ago`
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
    return `${Math.floor(mins / 1440)}d ago`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Achievements" sub="Badges earned by the community" />

      {/* Recent unlocks */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Recently Unlocked
        </div>
        {recent.loading ? (
          Array.from({ length: 5 }).map((_, i) => <Card key={i} style={{ marginBottom: 8 }}><Skeleton /></Card>)
        ) : (recent.data ?? []).length === 0 ? (
          <Card><p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No achievements earned yet</p></Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(recent.data ?? []).map((a, i) => {
              const def = a.achievement_definitions
              return (
                <Card key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{def?.emoji ?? '🏅'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{def?.name ?? a.achievement_id}</div>
                    {def?.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{def.description}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{timeAgo(a.earned_at)}</div>
                    {def?.xp_reward && (
                      <div style={{ fontSize: 11, color: '#f59e0b', fontFamily: 'var(--mono)', fontWeight: 700 }}>+{def.xp_reward} XP</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Avatar url={a.avatar_url} name={a.display_name ?? a.user_id} size={22} />
                    <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.display_name ?? `…${a.user_id.slice(-4)}`}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Achievement XP leaderboard */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Top Earners by Achievement XP
        </div>
        <Card>
          {top.loading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ marginBottom: 10 }}><Skeleton /></div>)
          ) : (top.data ?? []).length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: 12, padding: '12px 0' }}>No data yet</p>
          ) : (
            (top.data ?? []).map((r, i) => (
              <LBRow key={i} rank={i} label={r.display_name ?? `…${r.user_id.slice(-4)}`} value={`${r.achievement_xp.toLocaleString()} XP`} isFirst={i === 0} avatarUrl={r.avatar_url} />
            ))
          )}
        </Card>
      </div>
    </div>
  )
}

// ─── MEMBERS ─────────────────────────────────────────────────────────────────
function Members() {
  const { data, loading } = useData<MemberEntry[]>(() => apiFetch('/api/stats/members'))

  const tierForXP = (xp: number) => {
    if (xp >= 15000) return { name: 'Legend',  color: '#e74c3c', emoji: '🔴' }
    if (xp >= 5000)  return { name: 'Elite',   color: '#f39c12', emoji: '🟡' }
    if (xp >= 2000)  return { name: 'Veteran', color: '#9b59b6', emoji: '🟣' }
    if (xp >= 500)   return { name: 'Regular', color: '#2ecc71', emoji: '🟢' }
    if (xp >= 100)   return { name: 'Active',  color: '#3498db', emoji: '🔵' }
    return           { name: 'Member',  color: '#95a5a6', emoji: '⚪' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader
        title="Members"
        sub={loading ? 'Loading…' : `${(data ?? []).length} members tracked`}
      />
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {Array.from({ length: 12 }).map((_, i) => <Card key={i}><Skeleton /></Card>)}
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card><p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>No member profiles yet — members appear here after sending a message or joining voice.</p></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {(data ?? []).map(m => {
            const tier = tierForXP(m.total_earned)
            return (
              <Card key={m.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 14px', textAlign: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Avatar url={m.avatar_url} name={m.display_name} size={52} />
                  <span style={{
                    position: 'absolute', bottom: -4, right: -4,
                    fontSize: 14, lineHeight: 1,
                  }}>{tier.emoji}</span>
                </div>
                <div style={{ width: '100%' }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{m.display_name}</div>
                  <div style={{ fontSize: 11, color: tier.color, fontWeight: 600, marginTop: 2 }}>{tier.name}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-3)' }}>
                  <span title="Total XP">⚡ {m.total_earned.toLocaleString()}</span>
                  {m.streak > 0 && <span title="Streak">🔥 {m.streak}d</span>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ECONOMY ─────────────────────────────────────────────────────────────────
function Economy() {
  const leaderboard = useData<EconomyEntry[]>(() => apiFetch('/api/stats/economy/leaderboard'))
  const overview    = useData<EconomyOverview>(() => apiFetch('/api/stats/economy/overview'))

  const ov = overview.data
  const fmt = (n: number) => n.toLocaleString()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Economy" sub="Server coin supply, earnings, and richest members" />

      {/* Overview stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard label="Coins in Circulation" value={ov ? fmt(ov.totalSupply) : '—'}    icon="🪙" accent="#f59e0b" />
        <StatCard label="Total Ever Earned"     value={ov ? fmt(ov.totalEarned) : '—'}   icon="📈" accent="var(--green)" />
        <StatCard label="Total Spent"           value={ov ? fmt(ov.totalSpent) : '—'}    icon="🛍️" accent="#8b5cf6" />
        <StatCard label="Transactions"          value={ov ? fmt(ov.totalTransactions) : '—'} icon="📋" accent="var(--blue)" />
        <StatCard label="Active Wallets"        value={ov ? fmt(ov.activeUsers) : '—'}   icon="👛" accent="var(--primary)" />
      </div>

      {/* Richest leaderboard */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 16 }}>💰</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Richest Members</span>
        </div>
        {leaderboard.loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ marginBottom: 10 }}><Skeleton /></div>)
        ) : (leaderboard.data ?? []).length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No economy data yet — members earn coins by chatting, joining voice, and completing quests.
          </p>
        ) : (
          (leaderboard.data ?? []).map((r, i) => (
            <div key={r.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderBottom: '1px solid var(--border)',
              background: i === 0 ? 'var(--primary-lo)' : 'transparent',
              borderRadius: i === 0 ? 6 : 0,
            }}>
              <span style={{ width: 22, fontSize: i < 3 ? 15 : 11, fontFamily: 'var(--mono)', fontWeight: 700, flexShrink: 0, textAlign: 'center', color: i === 0 ? 'var(--gold)' : 'var(--text-3)' }}>
                {medal(i)}
              </span>
              <Avatar url={r.avatar_url} name={r.display_name ?? r.user_id} size={26} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--text)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.display_name ?? `…${r.user_id.slice(-4)}`}
              </span>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: i === 0 ? '#f59e0b' : 'var(--text-2)' }}>
                  {fmt(r.balance)} 🪙
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                  {fmt(r.total_earned)} earned · {fmt(r.total_spent)} spent
                </div>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Earn guide */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>💡 How to Earn Coins</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { icon: '💬', label: 'Send a message',       value: '2 coins (1/min)' },
            { icon: '🎙️', label: 'Voice time',            value: '5 coins / 5 min' },
            { icon: '🎯', label: 'Complete daily quest',  value: '25 – 75 coins' },
            { icon: '🎁', label: 'Daily /claim',          value: '100 coins / 24h' },
          ].map(e => (
            <div key={e.label} style={{ padding: '10px 12px', background: 'var(--elevated)', borderRadius: 6 }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{e.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{e.label}</div>
              <div style={{ fontSize: 11, color: '#f59e0b', fontFamily: 'var(--mono)', marginTop: 2 }}>{e.value}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'overview',      label: 'Overview',     icon: '📊' },
  { id: 'leaderboards',  label: 'Leaderboards', icon: '🏆' },
  { id: 'achievements',  label: 'Achievements', icon: '🏅' },
  { id: 'economy',       label: 'Economy',      icon: '🪙' },
  { id: 'members',       label: 'Members',      icon: '👥' },
  { id: 'voice',         label: 'Live Voice',   icon: '🔊' },
  { id: 'growth',        label: 'Growth',       icon: '📈' },
  { id: 'heatmap',       label: 'Heatmap',      icon: '🔥' },
]

function NavItem({ section, active, onClick }: { section: typeof SECTIONS[0]; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '9px 12px', borderRadius: 6, border: 'none', textAlign: 'left',
      background: active ? 'var(--primary-lo)' : 'transparent',
      color: active ? 'var(--primary)' : 'var(--text-3)',
      borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent',
      fontWeight: active ? 600 : 400, fontSize: 13,
      transition: 'all 0.15s',
      cursor: 'pointer',
    }}>
      <span style={{ fontSize: 14 }}>{section.icon}</span>
      {section.label}
    </button>
  )
}

// ─── TICKER ──────────────────────────────────────────────────────────────────
function RefreshTimer({ interval, onTick }: { interval: number; onTick: () => void }) {
  const [remaining, setRemaining] = useState(interval / 1000)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const rem = Math.max(0, Math.ceil((interval - elapsed) / 1000))
      setRemaining(rem)
      if (rem === 0) {
        onTick()
        startRef.current = Date.now()
        setRemaining(interval / 1000)
      }
    }, 500)
    return () => clearInterval(tick)
  }, [interval, onTick])

  const pct = (remaining / (interval / 1000)) * 100

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', position: 'relative',
        background: `conic-gradient(var(--primary) ${pct}%, var(--elevated) ${pct}%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-2)', fontWeight: 700,
        }}>{remaining}</div>
      </div>
      <span>Next refresh</span>
    </div>
  )
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [section, setSection]   = useState<Section>('overview')
  const [online, setOnline]     = useState<boolean | null>(null)
  const [refreshKey, setRefresh] = useState(0)

  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch(`${API}/health`)
      setOnline(r.ok)
    } catch { setOnline(false) }
  }, [])

  useEffect(() => { checkHealth() }, [checkHealth])

  const handleTick = useCallback(() => {
    setRefresh(k => k + 1)
    checkHealth()
  }, [checkHealth])

  const sectionEl = {
    overview:     <Overview key={`ov-${refreshKey}`} />,
    leaderboards: <Leaderboards key={`lb-${refreshKey}`} />,
    achievements: <Achievements key={`ac-${refreshKey}`} />,
    economy:      <Economy key={`ec-${refreshKey}`} />,
    members:      <Members key={`mb-${refreshKey}`} />,
    voice:        <LiveVoice key={`lv-${refreshKey}`} />,
    growth:       <MemberGrowth key={`mg-${refreshKey}`} />,
    heatmap:      <ActivityHeatmap key={`hm-${refreshKey}`} />,
  }[section]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: 210, flexShrink: 0, background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: '0 0 12px rgba(124,58,237,0.5)',
            }}>A</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>Archix</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Dashboard</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            {online === null ? (
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Checking…</span>
            ) : online ? (
              <>
                <Pulse color="var(--green)" />
                <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>Bot Online</span>
              </>
            ) : (
              <>
                <Pulse color="var(--red)" />
                <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>Bot Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflow: 'auto' }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', padding: '4px 12px 8px', fontWeight: 600 }}>
            Navigation
          </div>
          {SECTIONS.map(s => (
            <NavItem key={s.id} section={s} active={section === s.id} onClick={() => setSection(s.id)} />
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <RefreshTimer interval={REFRESH_MS} onTick={handleTick} />
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 8 }}>
            <Badge label="Live" color="var(--green)" /> Auto-refresh every 30s
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 28, paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>
              {SECTIONS.find(s => s.id === section)?.icon}{' '}
              {SECTIONS.find(s => s.id === section)?.label}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {!online && online !== null && (
            <div style={{
              padding: '8px 14px', background: 'var(--red)15',
              border: '1px solid var(--red)33', borderRadius: 6,
              fontSize: 12, color: 'var(--red)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ⚠️ API offline — showing cached data
            </div>
          )}
        </div>

        {/* Section content */}
        <div style={{ maxWidth: 1100 }}>
          {sectionEl}
        </div>
      </main>
    </div>
  )
}
