import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchAnalytics } from '../api/analytics'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const INTERACTION_ORDER = [
  'Minimal or no interaction today',
  'Online (texting, video calls, group chats)',
  'In person (class, campus, group study)',
  'Both online and offline',
]
const COLORS = [
  '#EC4899',
  '#EF4444',
  '#10B981',
  '#60A5FA',
  '#A78BFA',
  '#F59E0B',
  '#06B6D4',
  '#14B8A6',
]

/* ====================================================================
   Small presentational helpers
==================================================================== */
function StatBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="font-semibold text-lg mb-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Insights({ bullets }: { bullets: string[] }) {
  if (!bullets || !bullets.length) return null
  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm text-gray-700 dark:text-gray-200">
      <ul className="list-disc pl-5 space-y-1">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  )
}

function shortenInteractionLabel(full: string) {
  if (!full) return ''
  if (full.includes('Minimal')) return 'Minimal interaction'
  if (full.includes('Online (texting')) return 'Online (chat/calls)'
  if (full.includes('In person')) return 'In person'
  if (full.includes('Both online')) return 'Both online & offline'
  return full
}

function twoDec(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0
}

function ModeTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-800 p-2 rounded shadow text-sm">
      <div className="font-semibold">{p.team_interaction_mode}</div>
      <div>Avg mood: {twoDec(p.avg_mood)}</div>
      {typeof p.count !== 'undefined' && <div>Count: {p.count}</div>}
    </div>
  )
}

/* ====================================================================
   MAIN COMPONENT
==================================================================== */
export function TeamInsights(): JSX.Element {
  const { profile } = useAuth()
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [emotionImpact, setEmotionImpact] = useState<any[]>([])
  const [impactInsights, setImpactInsights] = useState<string>('')

  /* --------------------- Single fetch on mount ---------------------- */
  useEffect(() => {
    if (!profile?.id || profile.role !== 'MANAGER') return
    fetchAnalyticsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function fetchAnalyticsData() {
    if (!profile) return
    setAnalyticsLoading(true)
    try {
      const data = await fetchAnalytics(profile.id, 'MANAGER')
      setAnalytics({
        ...data,
        top_trigger_terms: normaliseTopTerms(data?.top_trigger_terms),
        interaction_mode_summary: data?.interaction_mode_summary || [],
        contagion_events: data?.contagion_events || [],
        erv_records: data?.erv_records || [],
      })
    } catch (err) {
      console.error('Analytics fetch error:', err)
      setAnalytics(null)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  function normaliseTopTerms(input: any) {
    if (!input) return []
    return (input || []).map((t: any) => {
      if (Array.isArray(t)) return { term: String(t[0]), score: Number(t[1] ?? 0) }
      if (typeof t === 'object' && t !== null) return { term: String(t.term ?? t[0] ?? ''), score: Number(t.score ?? t[1] ?? 0) }
      return { term: String(t), score: 0 }
    })
  }

  /* --------------------- Emotion Impact (from backend only) ---------------------- */
  function computeEmotionImpactFromBackend(backendAnalytics?: any) {
    const backendMetrics =
      backendAnalytics?.predicted_emotion_vs_team_metrics ||
      backendAnalytics?.predicted_emotion_vs_metrics ||
      backendAnalytics?.predictedEmotionVsTeamMetrics ||
      null
    if (backendMetrics && Array.isArray(backendMetrics) && backendMetrics.length) {
      return backendMetrics.map((r: any) => ({
        emotion: String(r.emotion ?? '').toLowerCase(),
        mood: Number(r.mood ?? r.avg_mood ?? 0),
        stress: Number(r.stress ?? r.avg_stress ?? 0),
        workload: Number(r.workload ?? r.avg_workload ?? 0),
        productivity: Number(r.productivity ?? r.avg_productivity ?? 0),
        count: Number(r.count ?? 0),
      }))
    }
    return []
  }

  useEffect(() => {
    const computed = computeEmotionImpactFromBackend(analytics)
    setEmotionImpact(computed)
    setImpactInsights(
      computed.length
        ? '• Joy & trust align with higher mood and productivity.\n' +
            '• Anger & fear align with higher stress and workload.\n' +
            '• Surprise can indicate active engagement with changes.'
        : 'No labelled emotions found.'
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics])

  /* --------------------- Derived values from backend summary_stats ---------------------- */
  const summary = analytics?.summary_stats || {}
  const avgMood: number | null = summary.avg_mood ?? null
  const avgStress: number | null = summary.avg_stress ?? null
  const avgWorkload: number | null = summary.avg_workload ?? null
  const avgProductivity: number | null = summary.avg_productivity ?? null
  const totalEntries: number = summary.total_entries ?? 0

  /* --------------------- Render guards ---------------------- */
  if (!profile) return <div>Loading…</div>
  if (profile.role !== 'MANAGER') {
    return (
      <div className="text-center mt-40">
        <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
        <p className="text-gray-600 dark:text-gray-400">Access denied — manager-only view.</p>
      </div>
    )
  }
  if (analyticsLoading) {
    return (
      <div className="flex justify-center mt-40">
        <div className="animate-spin rounded-full w-12 h-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  const formatMetric = (v: number | null, decimals = 2) => {
    if (v === null || Number.isNaN(v)) return 'N/A'
    return v.toFixed(decimals)
  }

  const dist = analytics?.emotion_distribution || {}
  const joyPct = Number(dist.joy ?? 0) * 100
  const trustPct = Number(dist.trust ?? 0) * 100
  const surprisePct = Number(dist.surprise ?? 0) * 100
  const sadnessPct = Number(dist.sadness ?? 0) * 100

  const timeCor = analytics?.time_correlations || {}
  const moodCorr = timeCor.overall_mood ?? null
  const prodCorr = timeCor.productivity ?? null
  const stressCorr = timeCor.stress ?? null

  const timeSummary = analytics?.time_summary || {}
  const timeByTeamRaw = analytics?.time_summary_by_team || {}
  const timeByTeam = Object.entries(timeByTeamRaw || {}).map(([teamName, vals]: any) => ({
    team: teamName,
    mean_hours: twoDec(Number(vals.mean_hours ?? 0)),
  }))

  const insightsForTime = [
    `More time together → mood +${moodCorr ?? 'N/A'}%, productivity +${prodCorr ?? 'N/A'}%, stress +${stressCorr ?? 'N/A'}%.`,
    'Encourage short shared work blocks or collaborative sessions to lift mood and productivity.',
  ]

  const insightsForDistribution = [
    `Joy ${joyPct.toFixed(1)}% and trust ${trustPct.toFixed(1)}% dominate — generally positive climate.`,
    `Surprise ${surprisePct.toFixed(1)}% indicates active engagement.`,
    `Sadness is rare (${sadnessPct.toFixed(1)}%) but linked to high stress/workload — follow up individually when seen.`,
    'Reinforce behaviours that generate joy & trust; follow up early on anger/fear check-ins.',
  ]

  const ims = analytics?.interaction_mode_summary || []
  const bestMode = ims.length
    ? ims.reduce((b: any, m: any) => ((m.avg_mood || 0) > (b.avg_mood || 0) ? m : b), ims[0])
    : null
  const insightsForMode = [
    bestMode
      ? `"${bestMode.team_interaction_mode}" associates with the highest mood.`
      : 'Hybrid interaction appears beneficial.',
    'Protect days with both online+offline contact where possible.',
  ]

  const emotionImpactRounded = (emotionImpact || []).map((e: any) => ({
    emotion: String(e.emotion ?? '').toLowerCase(),
    mood: twoDec(e.mood ?? 0),
    stress: twoDec(e.stress ?? 0),
    workload: twoDec(e.workload ?? 0),
    productivity: twoDec(e.productivity ?? 0),
    count: Number(e.count ?? 0),
  }))

  const insightsForEmotionImpact = [
    'Joy & trust → higher mood and productivity; protect these moments.',
    'Fear & sadness → much higher stress & workload; investigate and support affected people.',
  ]

  const insightsForContagion = [
    (analytics?.research_summary?.ETE_mean ?? 0) > 1
      ? 'ETE > 1: emotions can spread quickly across the team.'
      : 'Transmission not dominant.',
    'Celebrate positive moments explicitly; intervene early on negative spirals.',
    (analytics?.research_summary?.ACS_mean ?? 0) > 1.5
      ? 'Some members are highly absorbent — check one-on-one when load spikes.'
      : '',
  ].filter(Boolean)

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* HEADER */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Team Insights — Manager View</h1>
        <p className="text-gray-600 dark:text-gray-400">Research-oriented analytics across all teams · all time</p>
      </div>

      {/* Team summary bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Team Summary</h2>
          <span className="text-xs text-gray-500">All teams · all time</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-center">
            <p className="text-xs text-gray-500">Avg Mood</p>
            <p className="font-semibold text-lg">{formatMetric(avgMood)}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-center">
            <p className="text-xs text-gray-500">Avg Stress</p>
            <p className="font-semibold text-lg">{formatMetric(avgStress)}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-center">
            <p className="text-xs text-gray-500">Avg Workload</p>
            <p className="font-semibold text-lg">{formatMetric(avgWorkload)}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-center">
            <p className="text-xs text-gray-500">Avg Productivity</p>
            <p className="font-semibold text-lg">{formatMetric(avgProductivity)}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-center">
            <p className="text-xs text-gray-500">Total Check-ins</p>
            <p className="font-semibold text-lg">{totalEntries}</p>
          </div>
        </div>
      </div>

      {/* Time Spent Summary */}
      <StatBlock title="Time Spent Summary">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">Entries</p>
            <p className="font-semibold text-lg">{timeSummary.count ?? 'N/A'}</p>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">Mean</p>
            <p className="font-semibold text-lg">
              {timeSummary.mean_hours != null ? `${twoDec(Number(timeSummary.mean_hours))} hrs` : 'N/A'}
            </p>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">Median</p>
            <p className="font-semibold text-lg">
              {timeSummary.median_hours != null ? `${twoDec(Number(timeSummary.median_hours))} hrs` : 'N/A'}
            </p>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">25th pct</p>
            <p className="font-semibold text-lg">
              {timeSummary.p25_hours != null ? `${twoDec(Number(timeSummary.p25_hours))} hrs` : 'N/A'}
            </p>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">75th pct</p>
            <p className="font-semibold text-lg">
              {timeSummary.p75_hours != null ? `${twoDec(Number(timeSummary.p75_hours))} hrs` : 'N/A'}
            </p>
          </div>
        </div>

        <h4 className="font-semibold mt-6">Time Summary by Team — mean hours</h4>
        <div style={{ width: '100%', height: 220 }} className="mt-2">
          <ResponsiveContainer>
            <BarChart layout="vertical" data={timeByTeam} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" label={{ value: 'Mean hours', position: 'bottom' }} />
              <YAxis type="category" dataKey="team" width={200} interval={0} />
              <Tooltip formatter={(v: any) => `${twoDec(Number(v))} hrs`} />
              <Bar dataKey="mean_hours" fill={COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Insights bullets={insightsForTime} />
      </StatBlock>

      {/* Correlation with Time Spent */}
      <StatBlock title="Correlation with Time Spent">
        <p className="text-sm text-gray-500">How strongly time spent together relates to key wellbeing metrics.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
          {Object.entries(analytics?.time_correlations || {}).map(([k, v]: any) => {
            const pct = v === null || v === undefined ? null : Number(v)
            return (
              <div key={k} className="p-3 bg-gray-100 dark:bg-gray-700 rounded text-center">
                <p className="text-xs text-gray-500">{k}</p>
                <p className="font-semibold text-lg">{pct === null ? 'N/A' : `${twoDec(pct)}%`}</p>
              </div>
            )
          })}
        </div>
        <Insights bullets={insightsForTime} />
      </StatBlock>

      {/* Emotion Distribution */}
      <StatBlock title="Emotion Distribution (7 labels)">
        <p className="text-sm text-gray-500 mb-2">Percentage breakdown of predicted emotions across all check-ins.</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={Object.entries(analytics?.emotion_distribution || {}).map(([k, v]) => ({
                  name: k,
                  value: Number(v) || 0,
                }))}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label={(entry: any) => `${entry.name} ${(entry.value * 100).toFixed(1)}%`}
              >
                {Object.keys(analytics?.emotion_distribution || {}).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => `${(v * 100).toFixed(1)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6" style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart
              data={Object.entries(analytics?.emotion_distribution || {}).map(([emotion, proportion]) => ({
                emotion,
                proportion: Number(proportion) || 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="emotion" interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip formatter={(v: any) => `${(v * 100).toFixed(1)}%`} />
              <Bar dataKey="proportion">
                {Object.keys(analytics?.emotion_distribution || {}).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Insights bullets={insightsForDistribution} />
      </StatBlock>

      {/* Mood vs Interaction Mode */}
      <StatBlock title="Mood vs Interaction Mode">
        <p className="text-sm text-gray-500 mb-2">How different communication modes correlate with mood.</p>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart
              data={INTERACTION_ORDER.map((mode) => {
                const found = (analytics?.interaction_mode_summary || []).find(
                  (i: any) => i.team_interaction_mode === mode
                )
                return {
                  team_interaction_mode: mode,
                  team_interaction_mode_short: shortenInteractionLabel(mode),
                  avg_mood: twoDec(found ? Number(found.avg_mood || 0) : 0),
                  count: found ? found.count : 0,
                }
              })}
              margin={{ left: 20, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="team_interaction_mode_short" angle={-20} textAnchor="end" interval={0} height={80} />
              <YAxis />
              <Tooltip content={<ModeTooltip />} />
              <Bar dataKey="avg_mood" fill={COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Insights bullets={insightsForMode} />
      </StatBlock>

      {/* Predicted Emotion vs Team Metrics */}
      <StatBlock title="Predicted Emotion vs Team Metrics">
        <p className="text-sm text-gray-500 mb-2">Per-emotion averages of mood, stress, workload, and productivity.</p>
        <div style={{ width: '100%', height: 420 }}>
          <ResponsiveContainer>
            <BarChart layout="vertical" data={emotionImpactRounded} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="emotion" width={160} interval={0} />
              <Tooltip formatter={(value: any, name: string) => [twoDec(value), name]} />
              <Legend />
              <Bar dataKey="mood" fill={COLORS[0]} name="Mood" />
              <Bar dataKey="stress" fill={COLORS[1]} name="Stress" />
              <Bar dataKey="workload" fill={COLORS[2]} name="Workload" />
              <Bar dataKey="productivity" fill={COLORS[3]} name="Productivity" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded mt-4 whitespace-pre-line text-sm">{impactInsights}</div>
        <Insights bullets={insightsForEmotionImpact} />
      </StatBlock>

      {/* Top negative trigger terms */}
      <StatBlock title="Top Negative Trigger Terms (TF-IDF style)">
        <p className="text-sm text-gray-500 mb-2">
          Words that tend to appear in entries with lower mood or higher stress/workload.
        </p>
        <div className="flex flex-wrap">
          {(analytics?.top_trigger_terms || []).length ? (
            (analytics?.top_trigger_terms || []).map((t: any, i: number) => (
              <div key={i} className="px-3 py-1 mr-2 mb-2 rounded bg-gray-100 dark:bg-gray-700 text-sm">
                {t.term} <span className="text-xs text-gray-500">({Number(t.score).toFixed(2)})</span>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">No trigger terms available.</div>
          )}
        </div>
        <Insights bullets={['Follow up on recurring negative terms in check-ins; contextualise before action.']} />
      </StatBlock>

      {/* Contagion & composite metrics */}
      <StatBlock title="Contagion Metrics & Composite Indices">
        <p className="text-sm text-gray-500 mb-2">
          High-level indicators used in the research layer (e.g. ETE, ERI, TSI, ACS).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(analytics?.research_summary || {}).map(([k, v]: any) => (
            <div key={k} className="p-3 rounded bg-gray-100 dark:bg-gray-700">
              <p className="text-sm">{k}</p>
              <p className="font-bold text-lg">{typeof v === 'number' ? twoDec(v) : String(v)}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <MiniSpark title="ERI" series={analytics?.eri_series || []} color={COLORS[0]} />
          <MiniSpark title="ETE" series={analytics?.ete_series || []} color={COLORS[1]} />
          <MiniSpark title="TEDI" series={analytics?.tedi_series || []} color={COLORS[2]} />
          <MiniSpark title="TSI" series={analytics?.tsi_series || []} color={COLORS[3]} />
          <MiniSpark title="ECP" series={analytics?.ecp_series || []} color={COLORS[4]} />
          <MiniSpark title="ERI2" series={analytics?.eri2_series || []} color={COLORS[5]} />
          <MiniSpark title="ACS" series={analytics?.acs_series || []} color={COLORS[6]} />
        </div>
        <Insights bullets={insightsForContagion} />
      </StatBlock>
    </div>
  )
}

/* ====================================================================
   MINI SPARKLINES
==================================================================== */
function MiniSpark({ title, series, color }: { title: string; series: any[]; color: string }) {
  const data = (series || []).map((v: any, i: number) => ({ x: i, y: Number(v) || 0 }))
  return (
    <div className="p-3 rounded bg-gray-100 dark:bg-gray-700">
      <p className="text-sm">{title}</p>
      <div style={{ width: '100%', height: 64 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <Line type="monotone" dataKey="y" dot={false} stroke={color} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}