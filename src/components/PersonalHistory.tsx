import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Calendar, TrendingUp, Heart, Activity } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format, parseISO, subDays } from 'date-fns'

interface EmotionLog {
  id: string
  overall_mood: number | null
  stress: number
  productivity: number
  created_at: string
}

export function PersonalHistory() {
  const { profile } = useAuth()
  const [logs, setLogs] = useState<EmotionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30)

  useEffect(() => {
    if (profile) fetchEmotionLogs()
  }, [profile, timeRange])

  const fetchEmotionLogs = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const startDate = subDays(new Date(), timeRange).toISOString()

      const { data, error } = await supabase
        .from('emotion_logs')
        .select('id, overall_mood, stress, productivity, created_at')
        .eq('user_id', profile.id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })

      if (error) throw error

      setLogs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = logs.map(log => ({
    date: format(parseISO(log.created_at), 'MMM dd'),
    mood: log.overall_mood ?? 0,
    stress: log.stress,
    productivity: log.productivity,
  }))

  const averages = {
    mood: logs.length ? logs.reduce((s, l) => s + (l.overall_mood ?? 0), 0) / logs.length : 0,
    stress: logs.length ? logs.reduce((s, l) => s + l.stress, 0) / logs.length : 0,
    productivity: logs.length ? logs.reduce((s, l) => s + l.productivity, 0) / logs.length : 0,
  }

  const CustomTooltip = ({ active, payload, label }: any) =>
    active && payload ? (
      <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.dataKey}: {entry.value.toFixed(1)}
          </p>
        ))}
      </div>
    ) : null

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>
    )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between">
        <div>
          <h1 className="text-3xl font-bold">Personal History</h1>
          <p>Track your emotional trends</p>
        </div>

        <select
          value={timeRange}
          onChange={(e) => setTimeRange(parseInt(e.target.value))}
          className="px-3 py-2 border rounded"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 3 months</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow">
          <h3 className="text-sm mb-1">Average Mood</h3>
          <div className="text-3xl font-bold">{averages.mood.toFixed(1)}</div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow">
          <h3 className="text-sm mb-1">Average Stress</h3>
          <div className="text-3xl font-bold">{averages.stress.toFixed(1)}</div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow">
          <h3 className="text-sm mb-1">Average Productivity</h3>
          <div className="text-3xl font-bold">{averages.productivity.toFixed(1)}</div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 10]} />
            <Tooltip content={<CustomTooltip />} />
            <Line dataKey="mood" stroke="#EC4899" strokeWidth={2} />
            <Line dataKey="stress" stroke="#EF4444" strokeWidth={2} />
            <Line dataKey="productivity" stroke="#10B981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
