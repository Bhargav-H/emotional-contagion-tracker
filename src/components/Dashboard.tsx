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
  stress?: number | null;
  productivity?: number | null;
  key_event?: string | null;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
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
          "created_at, overall_mood, stress, productivity, key_event"
        )
        .eq("user_id", profile.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) return;

      const moodsCurr = (current ?? []).map((l) => l.overall_mood);
      const stressCurr = (current ?? []).map((l) => l.stress);

      setStats({
        checkInsThisWeek: current?.length ?? 0,
        avgMood: parseFloat(
          (
            moodsCurr
              .filter((n): n is number => typeof n === "number")
              .reduce((a, b) => a + b, 0) /
            (moodsCurr.filter((n): n is number => typeof n === "number").length || 1)
          ).toFixed(1)
        ),
        avgStress: parseFloat(
          (
            stressCurr
              .filter((n): n is number => typeof n === "number")
              .reduce((a, b) => a + b, 0) /
            (stressCurr.filter((n): n is number => typeof n === "number").length || 1)
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

  function moodToColor(mood?: number | null) {
    if (!mood) return "bg-gray-300";
    if (mood >= 4) return "bg-green-400";
    if (mood >= 3) return "bg-yellow-400";
    if (mood >= 2) return "bg-orange-400";
    return "bg-red-400";
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div className="space-y-6">

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon }, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold">{value}</h3>
            <p className="text-sm">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent Check-ins */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Check-Ins</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {recentActivity.length === 0 ? (
            <div>No recent logs.</div>
          ) : (
            recentActivity.map((log, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${moodToColor(
                    log.overall_mood
                  )}`}
                >
                  <Heart className="w-7 h-7" />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    Mood: {log.overall_mood ?? "N/A"}
                  </div>
                  <span className="text-xs">{formatDate(log.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
