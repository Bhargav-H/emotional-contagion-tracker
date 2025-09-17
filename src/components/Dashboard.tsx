import React, { useEffect, useState } from "react";
import { Heart, Activity, TrendingUp, Users, Calendar } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

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
        .from("emotion_logs")
        .select(
          "created_at, overall_mood, current_mood, stress, productivity, key_event"
        )
        .eq("user_id", profile.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) return;

      const moodsCurr = (current ?? []).map(
        (l) => l.overall_mood ?? l.current_mood
      );
      const stressCurr = (current ?? []).map((l) => l.stress);

      setStats({
        checkInsThisWeek: current?.length ?? 0,
        avgMood: parseFloat(
          (
            moodsCurr
              .filter((n): n is number => typeof n === "number")
              .reduce((a, b) => a + b, 0) /
            (moodsCurr.filter((n): n is number => typeof n === "number").length ||
              1)
          ).toFixed(1)
        ),
        avgStress: parseFloat(
          (
            stressCurr
              .filter((n): n is number => typeof n === "number")
              .reduce((a, b) => a + b, 0) /
            (stressCurr.filter((n): n is number => typeof n === "number").length ||
              1)
          ).toFixed(1)
        ),
      });

      setRecentActivity((current ?? []).slice(0, 3));
    }
    fetchStats();
  }, [profile]);

  const singleCheckInAction = () => onNavigate("checkin");

  const quickActions: ActionCardProps[] = [
    {
      title: "Check In",
      description: "Log your current emotional state",
      icon: Heart,
      action: singleCheckInAction,
      color: "from-pink-500 to-rose-500",
    },
    {
      title: "View History",
      description: "Track your emotional trends over time",
      icon: TrendingUp,
      action: () => onNavigate("history"),
      color: "from-green-500 to-emerald-500",
    },
    ...(profile?.role === "MANAGER" || profile?.role === "ADMIN"
      ? [
          {
            title: "Team Insights",
            description: "Monitor team emotional health",
            icon: Users,
            action: () => onNavigate("team"),
            color: "from-purple-500 to-indigo-500",
          },
        ]
      : []),
  ];

  const statCards: StatCardProps[] = [
    {
      label: "Check-ins This Week",
      value: stats.checkInsThisWeek,
      icon: Calendar,
    },
    {
      label: "Avg Mood Score",
      value: stats.avgMood,
      icon: Heart,
    },
    {
      label: "Stress Level",
      value: stats.avgStress,
      icon: Activity,
    },
  ];

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    // Example: "13 Sep 2025, 06:42 PM"
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  function moodToColor(mood?: number | null) {
    if (!mood) return "bg-gray-300";
    if (mood >= 4) return "bg-green-400";
    if (mood >= 3) return "bg-yellow-400";
    if (mood >= 2) return "bg-orange-400";
    return "bg-red-400";
  }

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
              How are you feeling today? Let's check in with your emotional
              well-being.
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
          <div
            key={index}
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {value}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {quickActions.map(
          ({ title, description, icon: Icon, action, color }, index) => (
            <button
              key={index}
              onClick={action}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group text-left"
            >
              <div
                className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${color} mb-4 group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {description}
              </p>
            </button>
          )
        )}
      </div>

      {/* Recent Check-Ins */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Check-Ins
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {recentActivity.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 col-span-full">
              No recent check-ins found.
            </div>
          ) : (
            recentActivity.map((log, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
              >
                <span
                  className={`flex-shrink-0 flex items-center justify-center rounded-full w-12 h-12 text-white ${moodToColor(
                    log.overall_mood ?? log.current_mood
                  )}`}
                  title="Mood"
                >
                  <Heart className="w-7 h-7" />
                </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800 dark:text-gray-100 truncate">
                        Mood: {log.overall_mood ?? log.current_mood ?? "N/A"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
