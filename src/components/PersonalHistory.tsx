import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Calendar, TrendingUp, Heart, Activity } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { format, parseISO, subDays } from 'date-fns'

interface EmotionLog {
  id: string
  overall_mood: number | null
  current_mood: number | null
  stress: number
  productivity: number
  created_at: string
}

export function PersonalHistory() {
  const { profile } = useAuth()
  const [logs, setLogs] = useState<EmotionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(30) // days

  useEffect(() => {
    if (profile) {
      fetchEmotionLogs()
    }
  }, [profile, timeRange])

  const fetchEmotionLogs = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const startDate = subDays(new Date(), timeRange).toISOString()
      
      const { data, error } = await supabase
        .from('emotion_logs')
        .select('*')
        .eq('user_id', profile.id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('Error fetching emotion logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const chartData = logs.map(log => ({
    date: format(parseISO(log.created_at), 'MMM dd'),
    mood: log.overall_mood || log.current_mood || 0,
    stress: log.stress,
    productivity: log.productivity,
    fullDate: log.created_at,
  }))

  const averages = {
    mood: logs.length > 0 ? logs.reduce((sum, log) => sum + (log.overall_mood || log.current_mood || 0), 0) / logs.length : 0,
    stress: logs.length > 0 ? logs.reduce((sum, log) => sum + log.stress, 0) / logs.length : 0,
    productivity: logs.length > 0 ? logs.reduce((sum, log) => sum + log.productivity, 0) / logs.length : 0,
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey === 'mood' && 'Mood: '}
              {entry.dataKey === 'stress' && 'Stress: '}
              {entry.dataKey === 'productivity' && 'Productivity: '}
              {entry.value.toFixed(1)}
            </p>
          ))}
        </div>
      )
    }
    return null
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Personal History</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your emotional trends over time</p>
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
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Average Mood</h3>
            <Heart className="w-5 h-5 text-pink-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {averages.mood.toFixed(1)}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Out of 5.0</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Average Stress</h3>
            <Activity className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {averages.stress.toFixed(1)}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Out of 5.0</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Average Productivity</h3>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {averages.productivity.toFixed(1)}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Out of 10.0</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Emotional Trends</h2>
        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
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
                  dataKey="mood" 
                  stroke="#EC4899" 
                  strokeWidth={2}
                  dot={{ fill: '#EC4899', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="stress" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="productivity" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12">
            <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No emotion logs found for the selected time range.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Complete your first check-in to start tracking your emotional trends.
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Mood (1-5)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Stress (1-5)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Productivity (0-10)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}