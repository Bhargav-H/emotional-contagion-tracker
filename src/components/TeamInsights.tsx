// src/components/TeamInsights.tsx
import React, { useState, useEffect } from 'react'
import {
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO, subDays } from 'date-fns'
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

interface TeamLog {
  date: string
  avg_mood: number
  avg_stress: number
  avg_productivity: number
  count: number
}

interface TeamMember {
  id: string
  name: string
  avg_mood: number
  last_checkin: string
}

export function TeamInsights() {
  const { profile } = useAuth()

  const [teamLogs, setTeamLogs] = useState<TeamLog[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState(30)

  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  useEffect(() => {
    if (profile && (profile.role === 'ADMIN' || profile.role === 'MANAGER')) {
      fetchData()
      fetchAnalyticsData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, timeRange])

  async function fetchAnalyticsData() {
    if (!profile) return
    setAnalyticsLoading(true)

    try {
      // Fetch global analytics for ALL rows (matches Colab)
      const data = await fetchAnalytics('ALL', 99999)

      const normalised = {
        ...data,
        top_trigger_terms: normaliseTopTerms(data?.top_trigger_terms),
        interaction_mode_summary: data?.interaction_mode_summary || [],
        contagion_events: data?.contagion_events || [],
        correlation_matrix: data?.correlation_matrix || {},
      }
      setAnalytics(normalised)
    } catch (err) {
      console.error('Analytics fetch error:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  function normaliseTopTerms(input: any) {
    if (!input) return []
    return (input || []).map((t: any) => {
      if (Array.isArray(t)) return { term: String(t[0]), score: Number(t[1] || 0) }
      if (typeof t === 'object') return { term: String(t[0] ?? t.term ?? t['0'] ?? ''), score: Number(t[1] ?? t.score ?? 0) }
      return { term: String(t), score: 0 }
    })
  }

  /**
   * fetchData() — GLOBAL fetch (no team filter)
   * - Loads emotion_logs in the date range (aggregates daily averages)
   * - Loads users + their emotion_logs (global)
   */
  async function fetchData() {
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'MANAGER')) return

    setLoading(true)

    try {
      const startDate = subDays(new Date(), timeRange).toISOString().split('.')[0] + 'Z'

      // Fetch emotion_logs globally for the timeRange
      const { data: logs, error: logsError } = await supabase
        .from('emotion_logs')
        .select('created_at, overall_mood, stress, productivity')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })
        // safety: fetch a large batch; you can tune or paginate if dataset grows
        .limit(2000)

      if (logsError) throw logsError

      const dailyMap: Record<string, { moods: number[]; stress: number[]; productivity: number[] }> = {}

      logs?.forEach((log: any) => {
        if (!log?.created_at) return
        // normalize created_at -> date key
        let parsed: Date
        try {
          parsed = parseISO(log.created_at)
        } catch {
          return
        }
        const dateKey = format(parsed, 'yyyy-MM-dd')
        if (!(dateKey in dailyMap)) {
          dailyMap[dateKey] = { moods: [], stress: [], productivity: [] }
        }
        if (typeof log.overall_mood === 'number') dailyMap[dateKey].moods.push(log.overall_mood)
        if (typeof log.stress === 'number') dailyMap[dateKey].stress.push(log.stress)
        if (typeof log.productivity === 'number') dailyMap[dateKey].productivity.push(log.productivity)
      })

      const aggregated = Object.entries(dailyMap)
        .map(([date, vals]) => {
          const average = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
          return {
            date: format(parseISO(date), 'MMM dd'),
            avg_mood: average(vals.moods),
            avg_stress: average(vals.stress),
            avg_productivity: average(vals.productivity),
            count: vals.moods.length,
          }
        })
        .sort((a, b) => {
          // keep chronological order by parsing month/day back to date; safe for short ranges
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        })
        .filter(d => d.count > 0)

      setTeamLogs(aggregated)

      // Fetch all users globally (so Team Members status is global)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, emotion_logs (overall_mood, created_at)')
        .limit(2000)

      if (usersError) throw usersError

      const processedMembers: TeamMember[] = []
      users?.forEach((user: any, idx: number) => {
        const ulogs = user.emotion_logs ?? []
        if (!ulogs || ulogs.length === 0) return

        const latest = ulogs
          .filter((l: any) => !!l?.created_at)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

        if (!latest) return

        processedMembers.push({
          id: user.id,
          name: user.name || `Member ${idx + 1}`,
          avg_mood: typeof latest.overall_mood === 'number' ? latest.overall_mood : 0,
          last_checkin: latest.created_at,
        })
      })

      setTeamMembers(processedMembers)
    } catch (err) {
      console.error(err)
      setTeamLogs([])
      setTeamMembers([])
    } finally {
      setLoading(false)
    }
  }

  const averages = {
    mood: teamLogs.length ? teamLogs.reduce((s, l) => s + l.avg_mood, 0) / teamLogs.length : 0,
    stress: teamLogs.length ? teamLogs.reduce((s, l) => s + l.avg_stress, 0) / teamLogs.length : 0,
    productivity: teamLogs.length ? teamLogs.reduce((s, l) => s + l.avg_productivity, 0) / teamLogs.length : 0,
  }

  const getColor = (value: number) => {
    if (value >= 4) return '#10B981'
    if (value >= 3) return '#FBBF24'
    return '#EF4444'
  }

  const COLORS = ['#EC4899', '#EF4444', '#10B981', '#60A5FA', '#A78BFA', '#F59E0B', '#06B6D4']

  if (!profile) return <div>Loading...</div>

  if (profile.role !== 'ADMIN' && profile.role !== 'MANAGER')
    return (
      <div className="text-center mt-40">
        <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
        <p className="text-gray-600 dark:text-gray-400">Access denied.</p>
      </div>
    )

  if (loading || analyticsLoading)
    return (
      <div className="flex justify-center mt-40">
        <div className="animate-spin rounded-full w-12 h-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    )

  // correlation table columns (align rows)
  const corrCols: string[] = analytics && analytics.correlation_matrix
    ? Object.keys(analytics.correlation_matrix)
    : []

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Insights (GLOBAL)</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor emotional metrics across the whole dataset</p>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar size={20} className="text-gray-500" />
          <select value={timeRange} onChange={(e) => setTimeRange(parseInt(e.target.value))} className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <SummaryCard title="Average Mood" value={averages.mood.toFixed(2)} color={getColor(averages.mood)} />
        <SummaryCard title="Average Stress" value={averages.stress.toFixed(2)} color={getColor(averages.stress)} />
        <SummaryCard title="Average Productivity" value={averages.productivity.toFixed(2)} color="#10B981" />
      </div>

      {/* TRENDS LINE CHART */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="font-semibold mb-2">Trends (daily averages — GLOBAL)</h3>
        {teamLogs.length ? (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={teamLogs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg_mood" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avg_stress" stroke={COLORS[1]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="avg_productivity" stroke={COLORS[2]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-10">No trend data available.</div>
        )}
      </div>

      {/* ADVANCED ANALYTICS */}
      {analytics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          <h2 className="text-xl font-semibold">Advanced Analytics (from manager pipeline)</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Emotion distribution (pie + list) */}
            <div>
              <h4 className="font-semibold mb-2">Emotion Distribution</h4>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={Object.entries(analytics.emotion_distribution || {}).map(([k, v]) => ({ name: k, value: Number(v) || 0 }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      label={(entry: any) => `${entry?.name ?? ''} ${Math.round(((entry?.value ?? 0) * 100))}%`}
                    >
                      {Object.keys(analytics.emotion_distribution || {}).map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="text-sm mt-2 grid grid-cols-2 gap-2">
                {Object.entries(analytics.emotion_distribution || {}).map(([key, val]) => (
                  <li key={key} className="p-1">
                    <strong>{key}</strong>: {(Number(val) * 100).toFixed(1)}%
                  </li>
                ))}
              </ul>
            </div>

            {/* Interaction mode summary + correlation */}
            <div>
              <h4 className="font-semibold mb-2">Interaction Mode → Avg Mood</h4>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={analytics.interaction_mode_summary || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="team_interaction_mode" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avg_mood" fill={COLORS[2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <h4 className="font-semibold mt-4 mb-2">Correlation Matrix</h4>
              <div className="overflow-auto text-sm">
                <table className="w-full table-auto text-left">
                  <thead>
                    <tr>
                      <th className="px-2 py-1">Metric</th>
                      {corrCols.map((col) => (
                        <th key={col} className="px-2 py-1">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analytics.correlation_matrix || {}).map(([rowKey, rowObj]: any) => (
                      <tr key={rowKey}>
                        <td className="px-2 py-1 font-semibold">{rowKey}</td>
                        {corrCols.map((col) => (
                          <td key={col} className="px-2 py-1">{Number((rowObj || {})[col] ?? 0).toFixed(2)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* TRIGGERS AND CONTAGION */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Top Negative Trigger Terms</h4>
              <div className="flex flex-wrap">
                {analytics.top_trigger_terms?.length ? (
                  analytics.top_trigger_terms.map((t: any, i: number) => (
                    <div key={i} className="px-3 py-1 mr-2 mb-2 rounded bg-gray-100 dark:bg-gray-700 text-sm">
                      {t.term} <span className="text-xs text-gray-500">({Number(t.score).toFixed(2)})</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">No trigger terms.</div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Contagion Events (alerts)</h4>
              <div className="text-sm">
                {analytics.contagion_events?.length ? (
                  <ul>
                    {analytics.contagion_events.map((c: any, i: number) => (
                      <li key={i} className="mb-2 p-2 rounded bg-red-50 dark:bg-red-900/30">
                        <strong>{c.class}</strong> — {c.date} — neg_share: {(Number(c.neg_share || 0) * 100).toFixed(1)}% — Δ: {(Number(c.delta_neg || 0) * 100).toFixed(1)}%
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500">No contagion events in range.</div>
                )}
              </div>
            </div>
          </div>

          {/* RESEARCH METRICS — large grid + sparklines */}
          <div>
            <h4 className="font-semibold mb-2">Research Metrics & Series</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(analytics.research_summary && Object.entries(analytics.research_summary)).map(([k, v]: any) => (
                <div key={k} className="p-3 rounded bg-gray-100 dark:bg-gray-700">
                  <p className="text-sm">{k}</p>
                  <p className="font-bold">{typeof v === 'number' ? Number(v).toFixed(2) : String(v)}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <MiniSpark title="ERI" series={analytics.eri_series || []} color={COLORS[0]} />
              <MiniSpark title="ETE" series={analytics.ete_series || []} color={COLORS[1]} />
              <MiniSpark title="TEDI" series={analytics.tedi_series || []} color={COLORS[2]} />
              <MiniSpark title="TSI" series={analytics.tsi_series || []} color={COLORS[3]} />
              <MiniSpark title="ECP" series={analytics.ecp_series || []} color={COLORS[4]} />
              <MiniSpark title="ERI2" series={analytics.eri2_series || []} color={COLORS[5]} />
            </div>
          </div>

          {/* ERV RECORDS */}
          <div>
            <h4 className="font-semibold mb-2">Recovery (ERV) Records</h4>
            {analytics.erv_records?.length ? (
              <div className="text-sm">
                <ul>
                  {analytics.erv_records.map((r: any, i: number) => (
                    <li key={i} className="mb-2 p-2 rounded bg-gray-50 dark:bg-gray-800">
                      Class: <strong>{r.class}</strong> — Start: {r.start} — Recovery days: {Number(r.recovery_days).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No ERV records.</div>
            )}
          </div>

        </div>
      )}

      {/* TEAM MEMBERS */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Team Members Status (GLOBAL)</h2>
        {teamMembers.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No team members found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {teamMembers.map((member, idx) => (
              <div key={member.id} className="p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{member.name || `Member ${idx + 1}`}</h3>
                  <div title={`Mood: ${member.avg_mood.toFixed(2)}`} style={{ backgroundColor: getColor(member.avg_mood) }} className="w-4 h-4 rounded-full" />
                </div>
                <p>Latest Mood: {member.avg_mood.toFixed(2)}</p>
                {member.last_checkin && (
                  <p className="text-sm text-gray-500">{format(parseISO(member.last_checkin), 'MMM dd, yyyy')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

/* MINI SPARKLINE COMPONENT (uses Recharts small line) */
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

/* SUMMARY CARD COMPONENT */
function SummaryCard({ title, value, icon: Icon, color, }: { title: string; value: string | number; icon?: React.ComponentType<any>; color?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold">{title}</h4>
        {Icon && <Icon className="text-gray-500 dark:text-gray-400" size={20} />}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
