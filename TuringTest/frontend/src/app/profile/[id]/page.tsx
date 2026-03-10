"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usersApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn, formatDate, formatPoints } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import StatCard from "@/components/ui/StatCard";
import {
  User, Trophy, Zap, TrendingUp, Calendar, Award, Crown, Star,
} from "lucide-react";

interface UserData {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
}

interface BTSState {
  current_streak: number;
  longest_streak: number;
  season_year: number;
}

interface Win {
  id: number;
  scope: string;
  rank: number;
  prize_description: string | null;
}

interface Entry {
  id: string;
  slate_id: number;
  total_points: number;
  rank_final: number | null;
  submitted_at: string;
  status: string;
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const isOwn = currentUser?.id === id;

  const [userData, setUserData] = useState<UserData | null>(null);
  const [btsState, setBtsState] = useState<BTSState | null>(null);
  const [wins, setWins] = useState<Win[]>([]);
  const [history, setHistory] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "history" | "wins">("overview");

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, histRes, winsRes] = await Promise.allSettled([
          usersApi.getProfile(id),
          usersApi.getHistory(id),
          usersApi.getWins(id),
        ]);
        if (profileRes.status === "fulfilled") {
          setUserData(profileRes.value.data.user);
          setBtsState(profileRes.value.data.bts_state);
          setWins(profileRes.value.data.recent_wins || []);
        }
        if (histRes.status === "fulfilled") setHistory(histRes.value.data || []);
        if (winsRes.status === "fulfilled") setWins(winsRes.value.data || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <LoadingSpinner size="lg" className="py-24" />;
  if (!userData) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-500">User not found</div>
  );

  const avgPoints = history.length
    ? history.reduce((s, e) => s + e.total_points, 0) / history.length
    : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Profile header */}
      <div className="glass-card p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shrink-0">
          <span className="text-surface-900 font-black text-2xl">
            {userData.display_name[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            {userData.display_name}
          </h1>
          {isOwn && (
            <p className="text-slate-400 text-sm">{userData.email}</p>
          )}
          <p className="text-slate-500 text-xs mt-1">
            Member since {formatDate(userData.created_at)}
          </p>
        </div>
        {wins.length > 0 && (
          <div className="text-center shrink-0">
            <p className="text-2xl font-bold text-neon-gold">{wins.length}</p>
            <p className="text-slate-400 text-xs">wins</p>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="DFS Entries"
          value={history.length}
          icon={TrendingUp}
          iconColor="text-brand-400"
        />
        <StatCard
          label="Avg Points"
          value={formatPoints(avgPoints)}
          icon={Star}
          iconColor="text-yellow-400"
        />
        <StatCard
          label="BTS Streak"
          value={btsState?.current_streak ?? 0}
          subvalue={btsState ? `Best: ${btsState.longest_streak}` : undefined}
          icon={Zap}
          iconColor="text-neon-green"
          highlight={!!btsState?.current_streak}
        />
        <StatCard
          label="Total Wins"
          value={wins.length}
          icon={Trophy}
          iconColor="text-neon-gold"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl border border-white/5 mb-5">
        {(["overview", "history", "wins"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize",
              tab === t ? "bg-surface-700 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          {btsState && (
            <div className="glass-card p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Zap size={16} className="text-neon-green" /> Beat The Streak
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Current Streak</p>
                  <p className="text-3xl font-black gradient-text">{btsState.current_streak}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Season Best</p>
                  <p className="text-3xl font-black text-neon-gold">{btsState.longest_streak}</p>
                </div>
              </div>
            </div>
          )}

          {wins.slice(0, 3).map((win) => (
            <div key={win.id} className="glass-card p-4 flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                win.rank === 1 ? "bg-yellow-500/20" : win.rank === 2 ? "bg-slate-400/20" : "bg-orange-500/20"
              )}>
                <Crown size={18} className={cn(
                  win.rank === 1 ? "text-neon-gold" : win.rank === 2 ? "text-slate-300" : "text-orange-400"
                )} />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">
                  #{win.rank} — {win.scope.charAt(0).toUpperCase() + win.scope.slice(1)} Win
                </p>
                {win.prize_description && (
                  <p className="text-slate-400 text-xs">{win.prize_description}</p>
                )}
              </div>
            </div>
          ))}

          {!btsState && wins.length === 0 && history.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <User size={40} className="mx-auto mb-3 opacity-30" />
              <p>No activity yet</p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="space-y-2">
          {!history.length ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p>No contest history</p>
            </div>
          ) : history.map((entry) => (
            <div key={entry.id} className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-brand-400" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Slate #{entry.slate_id}</p>
                <p className="text-slate-400 text-xs">
                  {entry.submitted_at ? formatDate(entry.submitted_at) : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-mono font-bold text-sm">{formatPoints(entry.total_points)} pts</p>
                {entry.rank_final && (
                  <p className="text-slate-400 text-xs">Rank #{entry.rank_final}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wins */}
      {tab === "wins" && (
        <div className="space-y-2">
          {!wins.length ? (
            <div className="text-center py-12 text-slate-500">
              <Award size={40} className="mx-auto mb-3 opacity-30" />
              <p>No wins yet — keep playing!</p>
            </div>
          ) : wins.map((win) => (
            <div key={win.id} className="glass-card p-4 flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                win.rank === 1 ? "rank-1" : win.rank === 2 ? "rank-2" : "rank-3"
              )}>
                {win.rank === 1 ? "🥇" : win.rank === 2 ? "🥈" : "🥉"}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold capitalize">
                  {win.scope} — Rank #{win.rank}
                </p>
                {win.prize_description && (
                  <p className="text-neon-green text-xs">{win.prize_description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
