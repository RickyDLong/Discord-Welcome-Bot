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
  voiceHoursToday: number
  messagesToday: number | null
  joinsToday: number
  leavesToday: number
}
interface PointsEntry  { user_id: string; points: number; total_earned: number }
interface VoiceEntry   { user_id: string; seconds: number }
interface MsgEntry     { user_id: string; count: number }
interface StreakEntry   { user_id: string; streak_count: number }
interface VoiceLive    { channel_id: string; channel_name: string; user_count: number; snapshot_at: string }
interface MemberEvent  { event_type: 'join' | 'leave'; created_at: string }
type Period = 'today' | 'week' | 'all'
type Section = 'overview' | 'leaderboards' | 'voice' | 'growth' | 'heatmap'

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

// ─── OVERVIEW SECTION ────────────────────────────────────────────────────────
function Overview() {
  const { data, loading } = useData<Overview>(() => apiFetch('/api/stats/overview'))

  const cards = [
    { label: 'Members',       value: data?.members       ?? '—', icon: '👥', accent: 'var(--primary)' },
    { label: 'Voice Hours',   value: data?.voiceHoursToday != null ? `${data.voiceHoursToday}h` : '—', icon: '🎙️', accent: 'var(--blue)' },
    { label: 'Messages Today',value: data?.messagesToday  ?? '—', icon: '💬', accent: '#8b5cf6' },
    { label: 'Joins Today',   value: data?.joinsToday     ?? '—', icon: '✅', accent: 'var(--green)', sub: `${data?.leavesToday ?? 0} left` },
  ]

  return (
    <div>
      <SectionHeader title="Server Overview" sub="Live stats updated every 30s" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><Skeleton /></Card>
            ))
          : cards.map(c => (
              <StatCard key={c.label} {...c} />
            ))
        }
      </div>
    </div>
  )
}

// ─── LEADERBOARD ROW ─────────────────────────────────────────────────────────
function LBRow({ rank, label, value, isFirst }: { rank: number; label: string; value: string; isFirst: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
      borderBottom: '1px solid var(--border)',
      background: isFirst ? 'var(--primary-lo)' : 'transparent',
      borderRadius: isFirst ? 6 : 0,
      paddingLeft: isFirst ? 10 : 0,
    }}>
      <span style={{
        width: 24, fontSize: isFirst ? 16 : 12,
        color: isFirst ? 'var(--gold)' : 'var(--text-3)',
        fontFamily: 'var(--mono)', fontWeight: 700, flexShrink: 0, textAlign: 'center',
      }}>{medal(rank)}</span>
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
  title: string; icon: string; rows: { label: string; value: string }[]; loading: boolean; empty: string
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
              <LBRow key={i} rank={i} label={r.label} value={r.value} isFirst={i === 0} />
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

  const pts    = useData<PointsEntry[]>(() => apiFetch('/api/stats/leaderboard/points'))
  const voice  = useData<VoiceEntry[]>(() => apiFetch(`/api/stats/leaderboard/voice?period=${period}`), [period])
  const msgs   = useData<MsgEntry[]>(() => apiFetch(`/api/stats/leaderboard/messages?period=${period}`), [period])
  const streaks = useData<StreakEntry[]>(() => apiFetch('/api/stats/leaderboard/streaks'))

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
          title="Points" icon="🏆" loading={pts.loading} empty="No data yet"
          rows={(pts.data ?? []).slice(0,5).map(r => ({
            label: `User …${shortId(r.user_id)}`,
            value: r.total_earned.toLocaleString(),
          }))}
        />
        <LBCard
          title="Voice Time" icon="🎙️" loading={voice.loading} empty="No voice activity"
          rows={(voice.data ?? []).slice(0,5).map(r => ({
            label: `User …${shortId(r.user_id)}`,
            value: fmtSecs(r.seconds),
          }))}
        />
        <LBCard
          title="Messages" icon="💬" loading={msgs.loading} empty="No messages yet"
          rows={(msgs.data ?? []).slice(0,5).map(r => ({
            label: `User …${shortId(r.user_id)}`,
            value: r.count.toLocaleString(),
          }))}
        />
        <LBCard
          title="Streaks" icon="🔥" loading={streaks.loading} empty="No streaks yet"
          rows={(streaks.data ?? []).slice(0,5).map(r => ({
            label: `User …${shortId(r.user_id)}`,
            value: `${r.streak_count}d`,
          }))}
        />
      </div>
    </div>
  )
}

// ─── LIVE VOICE ───────────────────────────────────────────────────────────────
function LiveVoice() {
  const { data, loading } = useData<VoiceLive[]>(() => apiFetch('/api/stats/voice/live'))

  const active = (data ?? []).filter(c => c.user_count > 0)

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {active.map(ch => (
            <Card key={ch.channel_id} style={{ borderColor: 'var(--green)33' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Pulse color="var(--green)" />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{ch.channel_name || `Channel ${shortId(ch.channel_id)}`}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>
                  {ch.user_count}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {ch.user_count === 1 ? 'member' : 'members'}
                </span>
              </div>
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

// ─── NAV ─────────────────────────────────────────────────────────────────────
const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'overview',     label: 'Overview',     icon: '📊' },
  { id: 'leaderboards', label: 'Leaderboards', icon: '🏆' },
  { id: 'voice',        label: 'Live Voice',   icon: '🔊' },
  { id: 'growth',       label: 'Growth',       icon: '📈' },
  { id: 'heatmap',      label: 'Heatmap',      icon: '🔥' },
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
