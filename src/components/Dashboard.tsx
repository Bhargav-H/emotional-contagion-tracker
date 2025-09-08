import React from 'react'
import { Heart, Activity, TrendingUp, Users, Calendar, Clock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface DashboardProps {
  onNavigate: (tab: string) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { profile } = useAuth()

  const quickActions = [
    {
      title: 'Quick Check-In',
      description: 'Log your current mood and stress level',
      icon: Heart,
      action: () => onNavigate('checkin'),
      color: 'from-pink-500 to-rose-500',
    },
    {
      title: 'Detailed Check-In',
      description: 'Complete emotional assessment with insights',
      icon: Activity,
      action: () => onNavigate('checkin'),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'View History',
      description: 'Track your emotional trends over time',
      icon: TrendingUp,
      action: () => onNavigate('history'),
      color: 'from-green-500 to-emerald-500',
    },
    ...(profile?.role === 'MANAGER' || profile?.role === 'ADMIN' ? [{
      title: 'Team Insights',
      description: 'Monitor team emotional health',
      icon: Users,
      action: () => onNavigate('team'),
      color: 'from-purple-500 to-indigo-500',
    }] : []),
  ]

  const stats = [
    { label: 'Check-ins This Week', value: '5', icon: Calendar, change: '+2' },
    { label: 'Avg Mood Score', value: '7.2', icon: Heart, change: '+0.3' },
    { label: 'Stress Level', value: '3.1', icon: Activity, change: '-0.5' },
    { label: 'Days Active', value: '12', icon: Clock, change: '+3' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              Welcome back, {profile?.name}! 👋
            </h1>
            <p className="text-blue-100">
              How are you feeling today? Let's check in with your emotional well-being.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
              <Heart className="w-10 h-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  {stat.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {quickActions.map((action, index) => {
          const Icon = action.icon
          return (
            <button
              key={index}
              onClick={action.action}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group text-left"
            >
              <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${action.color} mb-4 group-hover:scale-105 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {action.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {action.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { action: 'Quick check-in completed', time: '2 hours ago', mood: '😊' },
            { action: 'Weekly detailed assessment', time: 'Yesterday', mood: '😐' },
            { action: 'Mood trend improved', time: '3 days ago', mood: '📈' },
          ].map((item, index) => (
            <div key={index} className="flex items-center space-x-3 py-2">
              <div className="text-2xl">{item.mood}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.action}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}