import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Users,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format, parseISO, subDays } from 'date-fns'

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

  useEffect(() => {
    if (profile && (profile.role === 'ADMIN' || profile.role === 'MANAGER')) {
      fetchTeamData()
    }
  }, [profile, timeRange])

  async function fetchTeamData() {
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'MANAGER')) {
      return
    }

    setLoading(true)

    try {
      let teamId: string | null = null

      if (profile.role === 'ADMIN') {
        teamId = profile.team_id
      } else if (profile.role === 'MANAGER') {
        // fetch team where this manager is assigned
        const { data: managedTeam, error: managedTeamError } = await supabase
          .from('teams')
          .select('id')
          .eq('manager_id', profile.id)
          .limit(1)
          .single()

        if (managedTeamError) throw managedTeamError

        teamId = managedTeam?.id ?? null
      }

      if (!teamId) {
        setTeamLogs([])
        setTeamMembers([])
        setLoading(false)
        return
      }

      const startDate = subDays(new Date(), timeRange).toISOString()

      // fetch emotion logs for team
      const { data: logs, error: logsError } = await supabase
        .from('emotion_logs')
        .select('created_at, overall_mood, current_mood, stress, productivity')
        .eq('team_id', teamId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })

      if (logsError) throw logsError

      const dailyMap: Record<string, { moods: number[]; stress: number[]; productivity: number[] }> = {}

      logs?.forEach((log) => {
        const dateStr = format(parseISO(log.created_at), 'yyyy-MM-dd')
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { moods: [], stress: [], productivity: [] }
        }

        const mood = log.overall_mood ?? log.current_mood
        if (typeof mood === 'number') dailyMap[dateStr].moods.push(mood)
        if (typeof log.stress === 'number') dailyMap[dateStr].stress.push(log.stress)
        if (typeof log.productivity === 'number') dailyMap[dateStr].productivity.push(log.productivity)
      })

      const aggregated = Object.entries(dailyMap)
        .map(([date, vals]) => {
          const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
          return {
            date: format(parseISO(date), 'MMM dd'),
            avg_mood: avg(vals.moods),
            avg_stress: avg(vals.stress),
            avg_productivity: avg(vals.productivity),
            count: vals.moods.length,
          }
        })
        .filter((entry) => entry.count > 0)

      setTeamLogs(aggregated)

      // fetch users with nested emotion_logs (no order here)
      const { data: usersWithLogs, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          emotion_logs (
            overall_mood,
            current_mood,
            created_at
          )
        `)
        .eq('team_id', teamId)

      if (usersError) throw usersError

      type UserWithLogs = typeof usersWithLogs[0] & { emotion_logs: typeof usersWithLogs[0]['emotion_logs'] }
      const processedMembers: TeamMember[] = []
      const seen = new Set<string>()

      usersWithLogs?.forEach((user: UserWithLogs) => {
        if (!user || seen.has(user.id)) return

        // client-side sort of emotion_logs by date desc
        const sortedLogs = (user.emotion_logs ?? []).slice().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        if (sortedLogs.length === 0) return

        const latestLog = sortedLogs[0]

        processedMembers.push({
          id: user.id,
          name: user.name,
          avg_mood: latestLog.overall_mood ?? latestLog.current_mood ?? 0,
          last_checkin: latestLog.created_at,
        })

        seen.add(user.id)
      })

      setTeamMembers(processedMembers)
    } catch (error) {
      console.error('Error fetching team data:', error)
      setTeamLogs([])
      setTeamMembers([])
    } finally {
      setLoading(false)
    }
  }

  const averages = {
    mood: teamLogs.length ? teamLogs.reduce((sum, l) => sum + l.avg_mood, 0) / teamLogs.length : 0,
    stress: teamLogs.length ? teamLogs.reduce((sum, l) => sum + l.avg_stress, 0) / teamLogs.length : 0,
    productivity: teamLogs.length ? teamLogs.reduce((sum, l) => sum + l.avg_productivity, 0) / teamLogs.length : 0,
  }

  const getColor = (val: number) => {
    if (val >= 4) return '#10B981'
    if (val >= 3) return '#FBBF24'
    return '#EF4444'
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded shadow border border-gray-300 dark:border-gray-700">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: any, idx: number) => (
            <p key={idx} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey === 'avg_mood' && 'Mood: '}
              {entry.dataKey === 'avg_stress' && 'Stress: '}
              {entry.dataKey === 'avg_productivity' && 'Productivity: '}
              {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (!profile) return <div>Loading...</div>

  if (profile.role !== 'ADMIN' && profile.role !== 'MANAGER')
    return (
      <div className="text-center mt-40">
        <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
        <p className="text-gray-600 dark:text-gray-400">Access denied.</p>
      </div>
    )

  if (loading)
    return (
      <div className="flex justify-center mt-40">
        <div className="animate-spin rounded-full w-12 h-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    )

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Insights</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor your team’s emotional well-being</p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar size={20} className="text-gray-500" />
          <select
            value={timeRange}
            onChange={e => setTimeRange(parseInt(e.target.value))}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1 text-sm text-gray-900 dark:text-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <SummaryCard title="Team Size" value={teamMembers.length} icon={Users} />
        <SummaryCard title="Average Mood" value={averages.mood.toFixed(2)} color={getColor(averages.mood)} />
        <SummaryCard title="Average Stress" value={averages.stress.toFixed(2)} color={getColor(averages.stress)} />
        <SummaryCard title="Average Productivity" value={averages.productivity.toFixed(2)} color="#10B981" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {teamLogs.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={teamLogs}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.25} />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 10]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="avg_mood" stroke="#EC4899" strokeWidth={3} activeDot={{ r: 7 }} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="avg_stress" stroke="#EF4444" strokeWidth={3} activeDot={{ r: 7 }} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="avg_productivity" stroke="#10B981" strokeWidth={3} activeDot={{ r: 7 }} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-gray-500 py-20">No data available for selected range.</div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Team Members Status</h2>
        {teamMembers.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">No team members found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {teamMembers.map(member => (
              <div key={member.id} className="p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{member.name}</h3>
                  <div title={`Mood: ${member.avg_mood.toFixed(2)} / 5`} style={{ backgroundColor: getColor(member.avg_mood) }} className="w-4 h-4 rounded-full" />
                </div>
                <p>Latest mood: {member.avg_mood.toFixed(2)} / 5</p>
                {member.last_checkin && (
                  <p className="text-sm text-gray-500">
                    Last check-in: {format(parseISO(member.last_checkin), 'MMM dd, yyyy')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon?: React.ComponentType<any>; color?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold">{title}</h4>
        {Icon && <Icon className="text-gray-500 dark:text-gray-400" size={20} />}
      </div>
      <div className={`text-2xl font-bold ${color ? '' : 'text-gray-900 dark:text-white'}`} style={{ color }}>
        {value}
      </div>
    </div>
  )
}
