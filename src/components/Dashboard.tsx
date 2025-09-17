import React, { useEffect, useState } from 'react';
import { Heart, Activity, TrendingUp, Users, Calendar } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
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
  }>({
    checkInsThisWeek: 0,
    avgMood: 0,
    avgStress: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentLog[]>([]);

  useEffect(() => {
    async function fetchStats() {
      if (!profile) return;
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);

      const { data: current, error } = await supabase
        .from('emotion_logs')
        .select('created_at, overall_mood, current_mood, stress, productivity, key_event')
        .eq('user_id', profile.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) return;

      // Stats
      const moodsCurr = (current ?? []).map(l => l.overall_mood ?? l.current_mood);
      const stressCurr = (current ?? []).map(l => l.stress);

      setStats({
        checkInsThisWeek: current?.length ?? 0,
        avgMood: parseFloat(
          (moodsCurr.filter((n): n is number => typeof n === 'number').reduce((a, b) => a + b, 0) /
          (moodsCurr.filter((n): n is number => typeof n === 'number').length || 1)
          ).toFixed(1)
        ),
        avgStress: parseFloat(
          (stressCurr.filter((n): n is number => typeof n === 'number').reduce((a, b) => a + b, 0) /
          (stressCurr.filter((n): n is number => typeof n === 'number').length || 1)
          ).toFixed(1)
        ),
      });

      setRecentActivity((current ?? []).slice(0, 3));
    }
    fetchStats();
  }, [profile]);

  const singleCheckInAction = () => onNavigate('checkin');

  const quickActions: ActionCardProps[] = [
    {
      title: 'Check In',
      description: 'Log your current emotional state',
      icon: Heart,
      action: singleCheckInAction,
      color: 'from-pink-500 to-rose-500',
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
    },
    {
      label: 'Avg Mood Score',
      value: stats.avgMood,
      icon: Heart,
    },
    {
      label: 'Stress Level',
      value: stats.avgStress,
      icon: Activity,
    },
  ];

  function moodToEmoji(mood?: number | null) {
    if (mood == null) return '❓';
    const emojis = ['😢', '😕', '😐', '😊', '😄'];
    return emojis[Math.max(0, Math.min(4, (mood ?? 1) - 1))];
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon }, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Icon className="w-4 h-4 text-white" />
              </div>
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
                    {log.key_event ?? 'Emotional check-in recorded'}
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
