import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, BarChart, Bar } from 'recharts'
import { Users, Calendar, TrendingUp, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns'

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
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30)

  useEffect(() => {
    if (profile && (profile.role === 'MANAGER' || profile.role === 'ADMIN')) {
      fetchTeamData()
    }
  }, [profile, timeRange])

  const fetchTeamData = async () => {
    if (!profile || (profile.role !== 'MANAGER' && profile.role !== 'ADMIN')) return

    setLoading(true)
    try {
      const startDate = subDays(new Date(), timeRange).toISOString()
      
      // Fetch aggregated daily team data
      const { data: logs, error: logsError } = await supabase
        .from('emotion_logs')
        .select(`
          created_at,
          overall_mood,
          current_mood,
          stress,
          productivity,
          user_id
        `)
        .eq('team_id', profile.team_id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })

      if (logsError) throw logsError

      // Process logs into daily aggregations
      const dailyData: { [key: string]: { moods: number[], stress: number[], productivity: number[] } } = {}
      
      logs?.forEach(log => {
        const date = format(parseISO(log.created_at), 'yyyy-MM-dd')
        if (!dailyData[date]) {
          dailyData[date] = { moods: [], stress: [], productivity: [] }
        }
        
        const mood = log.overall_mood || log.current_mood
        if (mood) dailyData[date].moods.push(mood)
        dailyData[date].stress.push(log.stress)
        dailyData[date].productivity.push(log.productivity)
      })

      const aggregated: TeamLog[] = Object.entries(dailyData).map(([date, data]) => ({
        date: format(parseISO(date), 'MMM dd'),
        avg_mood: data.moods.length > 0 ? data.moods.reduce((a, b) => a + b, 0) / data.moods.length : 0,
        avg_stress: data.stress.reduce((a, b) => a + b, 0) / data.stress.length,
        avg_productivity: data.productivity.reduce((a, b) => a + b, 0) / data.productivity.length,
        count: data.moods.length,
      })).filter(item => item.count > 0)

      setTeamLogs(aggregated)

      // Fetch team members with their latest mood
      const { data: members, error: membersError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          emotion_logs!inner (
            overall_mood,
            current_mood,
            created_at
          )
        `)
        .eq('team_id', profile.team_id)
        .order('emotion_logs.created_at', { ascending: false })

      if (membersError) throw membersError

      // Process members data to get latest mood for each
      const processedMembers: TeamMember[] = []
      const memberMap = new Map()

      members?.forEach(member => {
        if (!memberMap.has(member.id)) {
          const mood = member.emotion_logs?.overall_mood || member.emotion_logs?.current_mood || 0
          memberMap.set(member.id, {
            id: member.id,
            name: member.name,
            avg_mood: mood,
            last_checkin: member.emotion_logs?.created_at || '',
          })
        }
      })

      setTeamMembers(Array.from(memberMap.values()))
    } catch (error) {
      console.error('Error fetching team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const averages = {
    mood: teamLogs.length > 0 ? teamLogs.reduce((sum, log) => sum + log.avg_mood, 0) / teamLogs.length : 0,
    stress: teamLogs.length > 0 ? teamLogs.reduce((sum, log) => sum + log.avg_stress, 0) / teamLogs.length : 0,
    productivity: teamLogs.length > 0 ? teamLogs.reduce((sum, log) => sum + log.avg_productivity, 0) / teamLogs.length : 0,
  }

  const getMoodColor = (mood: number) => {
    if (mood >= 4) return '#10B981' // Green
    if (mood >= 3) return '#F59E0B' // Yellow
    return '#EF4444' // Red
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey === 'avg_mood' && 'Avg Mood: '}
              {entry.dataKey === 'avg_stress' && 'Avg Stress: '}
              {entry.dataKey === 'avg_productivity' && 'Avg Productivity: '}
              {entry.value.toFixed(1)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (profile?.role !== 'MANAGER' && profile?.role !== 'ADMIN') {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          Access denied. This section is only available to managers and administrators.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Insights</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor your team's emotional health and trends</p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 3 months</option>
          </select>
        </div>
      </div>

      {/* Team Overview Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Team Size</h3>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {teamMembers.length}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Active members</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Avg Team Mood</h3>
            <div 
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: getMoodColor(averages.mood) }}
            />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {averages.mood.toFixed(1)}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Out of 5.0</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Avg Stress</h3>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {averages.stress.toFixed(1)}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Out of 5.0</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Avg Productivity</h3>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {averages.productivity.toFixed(1)}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Out of 10.0</p>
        </div>
      </div>

      {/* Team Trends Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Team Emotional Trends</h2>
        {teamLogs.length > 0 ? (
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={teamLogs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="#6B7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6B7280"
                  style={{ fontSize: '12px' }}
                  domain={[0, 10]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="avg_mood" 
                  stroke="#EC4899" 
                  strokeWidth={3}
                  dot={{ fill: '#EC4899', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avg_stress" 
                  stroke="#EF4444" 
                  strokeWidth={3}
                  dot={{ fill: '#EF4444', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avg_productivity" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No team data available for the selected time range.
            </p>
          </div>
        )}
      </div>

      {/* Team Members Status */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Team Members Status</h2>
        {teamMembers.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">{member.name}</h3>
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: getMoodColor(member.avg_mood) }}
                    title={`Mood: ${member.avg_mood}/5`}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Latest mood: {member.avg_mood.toFixed(1)}/5
                </p>
                {member.last_checkin && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Last check-in: {format(parseISO(member.last_checkin), 'MMM dd, yyyy')}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No team members found.
          </p>
        )}
      </div>
    </div>
  )
}