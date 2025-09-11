import React, { useEffect, useState } from 'react';
import { Heart, Activity, TrendingUp, Users, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  change?: string;
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  color: string;
}

interface RecentLog {
  created_at: string;
  overall_mood?: number | null;
  current_mood?: number | null;
  stress?: number | null;
  productivity?: number | null;
  key_event?: string | null;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<{
    checkInsThisWeek: number;
    avgMood: number;
    avgStress: number;
    daysActive: number;
    moodChange: number;
    stressChange: number;
    daysChange: number;
    checkInsChange: number;
  }>({
    checkInsThisWeek: 0,
    avgMood: 0,
    avgStress: 0,
    daysActive: 0,
    moodChange: 0,
    stressChange: 0,
    daysChange: 0,
    checkInsChange: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentLog[]>([]);

  useEffect(() => {
    async function fetchStats() {
      if (!profile) return;
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(today.getDate() - 14);

      // fetch current 7-day and previous 7-day logs
      const [{ data: current, error: error1 }, { data: prev, error: error2 }] = await Promise.all([
        supabase
          .from('emotion_logs')
          .select('created_at, overall_mood, current_mood, stress, productivity, key_event')
          .eq('user_id', profile.id)
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('emotion_logs')
          .select('created_at, overall_mood, current_mood, stress, productivity, key_event')
          .eq('user_id', profile.id)
          .gte('created_at', fourteenDaysAgo.toISOString())
          .lt('created_at', sevenDaysAgo.toISOString()),
      ]);

      if (error1 || error2) return;

      // Helpers for change calculation
      function avg(vals: (number | null | undefined)[]) {
        const n = vals.filter((v): v is number => typeof v === 'number');
        return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
      }
      function uniqueDays(logs: RecentLog[]) {
        return new Set(logs.map(l => l.created_at.split('T')[0])).size;
      }
      // Recent logs
      setRecentActivity((current ?? []).slice(0, 3));

      // Stats
      const moodsCurr = (current ?? []).map(l => l.overall_mood ?? l.current_mood);
      const stressCurr = (current ?? []).map(l => l.stress);
      const daysCurr = uniqueDays(current ?? []);

      const moodsPrev = (prev ?? []).map(l => l.overall_mood ?? l.current_mood);
      const stressPrev = (prev ?? []).map(l => l.stress);
      const daysPrev = uniqueDays(prev ?? []);

      setStats({
        checkInsThisWeek: current?.length ?? 0,
        avgMood: parseFloat(avg(moodsCurr).toFixed(1)),
        avgStress: parseFloat(avg(stressCurr).toFixed(1)),
        daysActive: daysCurr,
        checkInsChange: (current?.length ?? 0) - (prev?.length ?? 0),
        moodChange: parseFloat((avg(moodsCurr) - avg(moodsPrev)).toFixed(1)),
        stressChange: parseFloat((avg(stressCurr) - avg(stressPrev)).toFixed(1)),
        daysChange: daysCurr - daysPrev,
      });
    }
    fetchStats();
  }, [profile]);

  const quickActions: ActionCardProps[] = [
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
  ];

  const statCards: StatCardProps[] = [
    {
      label: 'Check-ins This Week',
      value: stats.checkInsThisWeek,
      icon: Calendar,
      change: stats.checkInsChange > 0 ? `+${stats.checkInsChange}` : stats.checkInsChange.toString(),
    },
    {
      label: 'Avg Mood Score',
      value: stats.avgMood,
      icon: Heart,
      change: stats.moodChange > 0 ? `+${stats.moodChange}` : stats.moodChange.toString(),
    },
    {
      label: 'Stress Level',
      value: stats.avgStress,
      icon: Activity,
      change: stats.stressChange > 0 ? `+${stats.stressChange}` : stats.stressChange.toString(),
    },
    {
      label: 'Days Active',
      value: stats.daysActive,
      icon: Clock,
      change: stats.daysChange > 0 ? `+${stats.daysChange}` : stats.daysChange.toString(),
    },
  ];

  // For emoji mood in recent activity
  function moodToEmoji(mood?: number | null) {
    if (mood == null) return '❓';
    const emojis = ['😢', '😕', '😐', '😊', '😄'];
    return emojis[Math.max(0, Math.min(4, mood - 1))];
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Welcome back, {profile?.name}! 👋</h1>
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
        {statCards.map(({ label, value, icon: Icon, change }, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${Number(change) >= 0 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                {Number(change) > 0 ? `+${change}` : change}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {quickActions.map(({ title, description, icon: Icon, action, color }, index) => (
          <button
            key={index}
            onClick={action}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group text-left"
          >
            <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${color} mb-4 group-hover:scale-105 transition-transform`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400">No recent activity found.</div>
          ) : (
            recentActivity.map((log, index) => (
              <div key={index} className="flex items-center space-x-3 py-2">
                <div className="text-2xl">{moodToEmoji(log.overall_mood ?? log.current_mood)}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.key_event ? log.key_event : 'Emotional check-in recorded'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
