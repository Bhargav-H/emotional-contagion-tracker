import React, { useEffect, useState } from 'react'
import { Calendar, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { subDays } from 'date-fns'
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

/* ------------------------------------------------------------------
   Helper: safe "IN" support for Supabase
------------------------------------------------------------------ */
function applyIn(builder: any, column: string, values: any[]) {
  const vals = (values || []).filter((v) => v !== null && v !== undefined)
  if (!vals.length) return builder
  if (typeof builder.in === 'function') {
    return builder.in(column, vals)
  }
  try {
    if (typeof builder.inFilter === 'function') {
      return builder.inFilter(column, vals)
    }
    if (typeof builder.filter === 'function') {
      const formatted = `(${vals.map((v) => `"${String(v)}"`).join(',')})`
      return builder.filter(column, 'in', formatted)
    }
  } catch {
    // fall through
  }
  throw new Error('Supabase client does not support .in(), .inFilter(), or .filter() for IN operations')
}

/* ----------------------------- Types ----------------------------- */
type TeamLog = {
  date: string
  avg_mood: number
  avg_stress: number
  avg_productivity: number
  count: number
}
type TeamMember = {
  id: string
  name: string
  avg_mood: number
  last_checkin: string
}
type Team = {
  id: string
  name: string
}

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

/* ====================================================================
   Helpers for label shortening + formatting
==================================================================== */
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

/* ====================================================================
   CUSTOM TOOLTIPS
==================================================================== */
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
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState(30)
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [rawLogs, setRawLogs] = useState<any[]>([])
  const [emotionImpact, setEmotionImpact] = useState<any[]>([])
  const [impactInsights, setImpactInsights] = useState<string>('')

  /* --------------------- Effects ---------------------- */
  useEffect(() => {
    if (!profile?.id || profile.role !== 'MANAGER') return
    fetchAnalyticsData()
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Re-fetch frontend data when team selection or time range changes
  useEffect(() => {
    if (!profile?.id || profile.role !== 'MANAGER') return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamIds, timeRange])

  /* --------------------- Fetch Analytics (backend) ---------------------- */
  async function fetchAnalyticsData() {
    if (!profile) return
    setAnalyticsLoading(true)
    try {
      const data = await fetchAnalytics(profile.id, timeRange, 'MANAGER')
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

  /* --------------------- Fetch frontend data (Supabase) ---------------------- */
  async function fetchData() {
    if (!profile || profile.role !== 'MANAGER') return
    setLoading(true)
    try {
      const startDate = subDays(new Date(), timeRange).toISOString().split('.')[0] + 'Z'
      // teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('manager_id', profile.id)
      if (teamsError) throw teamsError
      const managerTeams: Team[] = (teamsData ?? []).map((t: any) => ({ id: t.id, name: t.name }))
      const managerTeamIds = managerTeams.map((t) => t.id).filter(Boolean)
      setTeams(managerTeams)

      let effectiveTeamIds: string[] = []
      if (selectedTeamIds.length) {
        const allowed = new Set(managerTeamIds)
        effectiveTeamIds = selectedTeamIds.filter((id) => allowed.has(id))
      } else {
        effectiveTeamIds = managerTeamIds
      }

      if (!effectiveTeamIds.length) {
        setRawLogs([])
        setEmotionImpact([])
        setImpactInsights('')
        setTeamMembers([])
        return
      }

      let logsQuery = supabase
        .from('emotion_logs')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })
        .limit(5000)
      logsQuery = applyIn(logsQuery, 'team_id', effectiveTeamIds)
      const { data: logs, error: logsError } = await logsQuery
      if (logsError) throw logsError
      const filtered = (logs ?? []).filter((l: any) => l.created_at && new Date(l.created_at) >= new Date(startDate))
      setRawLogs(filtered)

      let usersQuery = supabase
        .from('users')
        .select('id, name, team_id, emotion_logs (overall_mood, created_at)')
        .limit(2000)
      usersQuery = applyIn(usersQuery, 'team_id', effectiveTeamIds)
      const { data: users, error: usersError } = await usersQuery
      if (usersError) throw usersError
      const members: TeamMember[] = []
      for (const u of users ?? []) {
        const logsForUser = u.emotion_logs ?? []
        if (!logsForUser.length) continue
        const latest = logsForUser
          .filter((l: any) => l.created_at)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        members.push({
          id: u.id,
          name: u.name || 'Member',
          avg_mood: latest.overall_mood ?? 0,
          last_checkin: latest.created_at,
        })
      }
      setTeamMembers(members)
    } catch (err) {
      console.error('fetchData error', err)
      setRawLogs([])
      setEmotionImpact([])
      setImpactInsights('')
      setTeamMembers([])
    } finally {
      setLoading(false)
    }
  }

  /* --------------------- Emotion Impact ---------------------- */
  function computeEmotionImpactFromLogs(logs: any[], backendAnalytics?: any) {
    const map: Record<string, { mood: number[]; stress: number[]; workload: number[]; productivity: number[]; count: number }> = {}
    for (const l of logs || []) {
      let rawLabel = (l.final_label ?? l.ml_label ?? l.rule_label ?? l.emotion ?? l.label ?? '') as string
      rawLabel = String(rawLabel ?? '').trim()
      if (!rawLabel) continue
      const e = rawLabel.toLowerCase().trim()
      if (!e) continue
      if (!map[e]) map[e] = { mood: [], stress: [], workload: [], productivity: [], count: 0 }
      const safeNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
      const moodVal = safeNum(l.overall_mood ?? l.mood ?? l.avg_mood ?? l.avgMood ?? 0)
      const stressVal = safeNum(l.stress ?? l.stress_level ?? 0)
      const workloadVal = safeNum(l.workload ?? l.workload_hours ?? 0)
      const prodVal = safeNum(l.productivity ?? l.productivity_score ?? l.prod ?? 0)
      map[e].mood.push(moodVal)
      map[e].stress.push(stressVal)
      map[e].workload.push(workloadVal)
      map[e].productivity.push(prodVal)
      map[e].count++
    }
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
    const observedLabels = Object.keys(map).sort()
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
    const final = observedLabels.map((emotion) => {
      const vals = map[emotion] ?? { mood: [], stress: [], workload: [], productivity: [], count: 0 }
      return {
        emotion,
        mood: Number(avg(vals.mood)),
        stress: Number(avg(vals.stress)),
        workload: Number(avg(vals.workload)),
        productivity: Number(avg(vals.productivity)),
        count: Number(vals.count ?? 0),
      }
    })
    final.sort((a, b) => b.count - a.count)
    return final
  }

  useEffect(() => {
    const computed = computeEmotionImpactFromLogs(rawLogs, analytics)
    setEmotionImpact(computed)
    if (Array.isArray(computed) && computed.length) {
      setImpactInsights(
        '• Joy & trust align with higher mood and productivity.\n' +
          '• Anger & fear align with higher stress and workload.\n' +
          '• Surprise can indicate active engagement with changes.'
      )
    } else {
      setImpactInsights('No labelled emotions found in the selected time range.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawLogs, analytics])

  /* --------------------- Derived values for UI ---------------------- */
  const totalEntries = rawLogs.length
  let avgMood: number | null = null
  let avgStress: number | null = null
  let avgWorkload: number | null = null
  let avgProductivity: number | null = null
  if (totalEntries > 0) {
    let moodSum = 0; let moodCount = 0
    let stressSum = 0; let stressCount = 0
    let workloadSum = 0; let workloadCount = 0
    let prodSum = 0; let prodCount = 0
    for (const l of rawLogs) {
      if (typeof l.overall_mood === 'number') { moodSum += l.overall_mood; moodCount += 1 }
      if (typeof l.stress === 'number') { stressSum += l.stress; stressCount += 1 }
      if (typeof l.workload === 'number') { workloadSum += l.workload; workloadCount += 1 }
      if (typeof l.productivity === 'number') { prodSum += l.productivity; prodCount += 1 }
    }
    avgMood = moodCount ? moodSum / moodCount : null
    avgStress = stressCount ? stressSum / stressCount : null
    avgWorkload = workloadCount ? workloadSum / workloadCount : null
    avgProductivity = prodCount ? prodSum / prodCount : null
  }
  const teamsSelectedCount = selectedTeamIds.length
  const totalTeamsForManager = teams.length

  const getColor = (v: number) => {
    if (v >= 4) return '#10B981'
    if (v >= 3) return '#FBBF24'
    return '#EF4444'
  }

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
  if (loading || analyticsLoading) {
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

  const teamsLabel =
    teamsSelectedCount === 0
      ? 'No teams selected'
      : teamsSelectedCount === totalTeamsForManager
      ? `All teams (${totalTeamsForManager})`
      : `${teamsSelectedCount} / ${totalTeamsForManager} teams`

  // --- Build per-block insights (short bullets) ---
  const dist = analytics?.emotion_distribution || {}
  const joyPct = Number(dist.joy ?? 0) * 100
  const trustPct = Number(dist.trust ?? 0) * 100
  const surprisePct = Number(dist.surprise ?? 0) * 100
  const sadnessPct = Number(dist.sadness ?? 0) * 100
  const angerFearPct = (Number(dist.anger ?? 0) + Number(dist.fear ?? 0)) * 100

  const timeCor = analytics?.time_correlations || {}
  const moodCorr = timeCor.overall_mood ?? null
  const prodCorr = timeCor.productivity ?? null
  const stressCorr = timeCor.stress ?? null

  const timeSummary = analytics?.time_summary || {}
  const timeByTeamRaw = analytics?.time_summary_by_team || {}
  const timeByTeam = Object.entries(timeByTeamRaw || {}).map(([teamName, vals]: any) => ({ team: teamName, mean_hours: twoDec(Number(vals.mean_hours ?? 0)) }))

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
  const bestMode = ims.length ? ims.reduce((b: any, m: any) => ((m.avg_mood || 0) > (b.avg_mood || 0) ? m : b), ims[0]) : null
  const insightsForMode = [
    bestMode ? `"${bestMode.team_interaction_mode}" associates with the highest mood.` : 'Hybrid interaction appears beneficial.',
    'Protect days with both online+offline contact where possible.',
  ]

  // Round emotionImpact values for display and ensure category axis shows all labels
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
    (analytics?.research_summary?.ETE_mean ?? 0) > 1 ? 'ETE > 1: emotions can spread quickly across the team.' : 'Transmission not dominant.',
    'Celebrate positive moments explicitly; intervene early on negative spirals.',
    (analytics?.research_summary?.ACS_mean ?? 0) > 1.5 ? 'Some members are highly absorbent — check one-on-one when load spikes.' : '',
  ].filter(Boolean)

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold">Team Insights — Manager View</h1>
          <p className="text-gray-600 dark:text-gray-400">Research-oriented analytics across your teams</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Calendar size={20} className="text-gray-500" />
            <select
              value={timeRange}
              onChange={(e) => {
                const newRange = parseInt(e.target.value)
                setTimeRange(newRange)
                fetchAnalyticsData()
                fetchData()
              }}
              className="rounded-md border px-3 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 365 days</option>
            </select>
          </div>
          <TeamMultiSelect teams={teams} selectedIds={selectedTeamIds} onChange={(ids) => setSelectedTeamIds(ids)} />
        </div>
      </div>

      {/* Team summary bar (keeps changing; no interpretation) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Team Summary</h2>
          <span className="text-xs text-gray-500">{teamsLabel}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-center">
            <p className="text-xs text-gray-500">Teams Selected</p>
            <p className="font-semibold text-lg">{teamsSelectedCount} / {totalTeamsForManager || 0}</p>
          </div>
        </div>
      </div>

      {/* Time Spent Summary block */}
      <StatBlock title="Time Spent Summary">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">Entries</p>
            <p className="font-semibold text-lg">{timeSummary.count ?? 'N/A'}</p>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">Mean</p>
            <p className="font-semibold text-lg">{timeSummary.mean_hours != null ? `${twoDec(Number(timeSummary.mean_hours))} hrs` : 'N/A'}</p>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">Median</p>
            <p className="font-semibold text-lg">{timeSummary.median_hours != null ? `${twoDec(Number(timeSummary.median_hours))} hrs` : 'N/A'}</p>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">25th pct</p>
            <p className="font-semibold text-lg">{timeSummary.p25_hours != null ? `${twoDec(Number(timeSummary.p25_hours))} hrs` : 'N/A'}</p>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-xs text-gray-500">75th pct</p>
            <p className="font-semibold text-lg">{timeSummary.p75_hours != null ? `${twoDec(Number(timeSummary.p75_hours))} hrs` : 'N/A'}</p>
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
                data={Object.entries(analytics?.emotion_distribution || {}).map(([k, v]) => ({ name: k, value: Number(v) || 0 }))}
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
            <BarChart data={Object.entries(analytics?.emotion_distribution || {}).map(([emotion, proportion]) => ({ emotion, proportion: Number(proportion) || 0 }))}>
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
                const found = (analytics?.interaction_mode_summary || []).find((i: any) => i.team_interaction_mode === mode)
                return { team_interaction_mode: mode, team_interaction_mode_short: shortenInteractionLabel(mode), avg_mood: twoDec(found ? Number(found.avg_mood || 0) : 0), count: found ? found.count : 0 }
              })}
              margin={{ left: 20, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              {/* show shortened label on X axis, full label available in tooltip */}
              <XAxis dataKey="team_interaction_mode_short" angle={-20} textAnchor="end" interval={0} height={80} />
              <YAxis />
              <Tooltip content={<ModeTooltip />} />
              <Bar dataKey="avg_mood" fill={COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Insights bullets={insightsForMode} />
      </StatBlock>

      {/* Predicted Emotion vs Team Metrics (horizontal layout so category labels are always visible) */}
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
        <p className="text-sm text-gray-500 mb-2">Words that tend to appear in entries with lower mood or higher stress/workload.</p>
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
        <Insights bullets={[ 'Follow up on recurring negative terms in check-ins; contextualise before action.' ]} />
      </StatBlock>

      {/* Contagion & composite metrics */}
      <StatBlock title="Contagion Metrics & Composite Indices">
        <p className="text-sm text-gray-500 mb-2">High-level indicators used in the research layer (e.g. ETE, ERI, TSI, ACS).</p>
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

      {/* NOTE: Team Members Status intentionally removed as requested */}
    </div>
  )
}

/* ====================================================================
   TEAM MULTI-SELECT DROPDOWN (custom Tailwind UI)
==================================================================== */
function TeamMultiSelect({ teams, selectedIds, onChange }: { teams: Team[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const allIds = teams.map((t) => t.id)
  const allSelected = teams.length > 0 && selectedIds.length === teams.length
  const noneSelected = selectedIds.length === 0
  const handleToggleAll = () => {
    if (allSelected) onChange([])
    else onChange(allIds)
  }
  const toggleTeam = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((tid) => tid !== id))
    else onChange([...selectedIds, id])
  }
  let label = 'All teams'
  if (noneSelected) label = 'No teams selected'
  else if (allSelected) label = `All teams (${teams.length})`
  else label = `${selectedIds.length} / ${teams.length} teams`
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)} className="inline-flex items-center justify-between rounded-md border px-3 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 min-w-[180px]">
        <span className="truncate">{label}</span>
        <svg className={`ml-2 h-4 w-4 transform transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20 max-h-64 overflow-auto">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs text-gray-500">Filter teams</span>
            <button type="button" onClick={handleToggleAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{allSelected ? 'Clear all' : 'Select all'}</button>
          </div>
          <div className="py-1">
            {teams.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No teams available.</div>}
            {teams.map((t) => (
              <label key={t.id} className="flex items-center space-x-2 text-sm px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <input type="checkbox" className="form-checkbox h-4 w-4" checked={selectedIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                <span className="truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
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
