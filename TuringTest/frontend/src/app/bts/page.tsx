"use client";

import { useEffect, useState } from "react";
import { btsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import LeaderboardTable from "@/components/ui/LeaderboardTable";
import toast from "react-hot-toast";
import { Zap, Trophy, CheckCircle2, XCircle, Clock, Plus, Minus } from "lucide-react";
import Link from "next/link";

interface Player {
  id: number;
  full_name: string;
  primary_position: string;
  team?: { team_code: string } | null;
}

interface BTSEntry {
  id: string;
  success: boolean | null;
  picks: { player: Player }[];
  bts_day?: { date: string };
}

interface BTSState {
  current_streak: number;
  longest_streak: number;
  season_year: number;
  last_played: string | null;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  current_streak: number;
  longest_streak: number;
  last_played: string | null;
}

type Tab = "pick" | "history" | "leaderboard";

export default function BTSPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("pick");
  const [state, setState] = useState<BTSState | null>(null);
  const [todayEntry, setTodayEntry] = useState<BTSEntry | null>(null);
  const [recentEntries, setRecentEntries] = useState<BTSEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Mock players for picking (in production, fetch active players)
  const mockPlayers: Player[] = [
    { id: 1, full_name: "Marcus Johnson", primary_position: "CF", team: { team_code: "HBG" } },
    { id: 2, full_name: "Tyler Rodriguez", primary_position: "1B", team: { team_code: "HBG" } },
    { id: 4, full_name: "Sam Chen", primary_position: "SS", team: { team_code: "ALT" } },
    { id: 5, full_name: "Jake Thompson", primary_position: "2B", team: { team_code: "ALT" } },
    { id: 7, full_name: "Chris Martinez", primary_position: "RF", team: { team_code: "ERE" } },
    { id: 8, full_name: "Kevin Lee", primary_position: "3B", team: { team_code: "ERE" } },
    { id: 10, full_name: "Josh Davis", primary_position: "C", team: { team_code: "BGM" } },
    { id: 11, full_name: "Dante Brooks", primary_position: "LF", team: { team_code: "BGM" } },
  ];

  useEffect(() => {
    async function load() {
      try {
        const [lbRes, meRes] = await Promise.allSettled([
          btsApi.getLeaderboard(),
          user ? btsApi.getMe() : Promise.reject(null),
        ]);
        if (lbRes.status === "fulfilled") setLeaderboard(lbRes.value.data);
        if (meRes.status === "fulfilled") {
          const d = meRes.value.data;
          setState(d.state);
          setTodayEntry(d.today_entry);
          setRecentEntries(d.recent_entries || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const submit = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!selectedIds.length) { toast.error("Select at least 1 player"); return; }
    setSubmitting(true);
    try {
      const res = await btsApi.submitEntry(selectedIds);
      setTodayEntry(res.data);
      toast.success("Picks submitted! Good luck! 🔥");
      setTab("history");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-24" />;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Zap size={20} className="text-neon-green" />
          </div>
          <div>
            <h1 className="page-title">Beat The Streak</h1>
            <p className="page-subtitle">Pick up to 5 players to get a hit. Keep it going all season.</p>
          </div>
        </div>
      </div>

      {/* Streak stats */}
      {user && state && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="glass-card p-4 text-center">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Current Streak</p>
            <p className="text-4xl font-black gradient-text" style={{ fontFamily: "var(--font-display)" }}>
              {state.current_streak}
            </p>
            <p className="text-slate-500 text-xs mt-1">days</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Longest Streak</p>
            <p className="text-4xl font-black text-neon-gold" style={{ fontFamily: "var(--font-display)" }}>
              {state.longest_streak}
            </p>
            <p className="text-slate-500 text-xs mt-1">days</p>
          </div>
        </div>
      )}

      {!user && (
        <div className="glass-card p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Join to track your streak</p>
            <p className="text-slate-400 text-sm">Sign in to save your picks and compete</p>
          </div>
          <div className="flex gap-2">
            <Link href="/auth/login" className="btn-ghost border border-white/10 rounded-xl text-sm px-4 py-2">
              Sign In
            </Link>
            <Link href="/auth/register" className="btn-primary text-sm px-4 py-2">
              Register
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl border border-white/5 mb-5">
        {(["pick", "history", "leaderboard"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize",
              tab === t ? "bg-surface-700 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {t === "leaderboard" ? <><Trophy size={13} className="inline mr-1" />Leaders</> : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Pick tab */}
      {tab === "pick" && (
        <div>
          {todayEntry ? (
            <div className="glass-card p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-brand-400" />
                <p className="text-white font-semibold">Today&apos;s Picks Submitted</p>
                {todayEntry.success === null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Pending</span>
                )}
                {todayEntry.success === true && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-neon-green">Success!</span>
                )}
                {todayEntry.success === false && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Failed</span>
                )}
              </div>
              <div className="space-y-2">
                {todayEntry.picks.map((pick) => (
                  <div key={pick.player.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                    <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <span className="text-neon-green text-xs font-bold">{pick.player.primary_position}</span>
                    </div>
                    <span className="text-white text-sm font-medium flex-1">{pick.player.full_name}</span>
                    <span className="text-slate-400 text-xs">{pick.player.team?.team_code}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-400 text-sm">
                  Select players to get a hit today{" "}
                  <span className={cn("font-medium", selectedIds.length === 5 ? "text-neon-green" : "text-white")}>
                    ({selectedIds.length}/5)
                  </span>
                </p>
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-slate-500 text-xs hover:text-slate-300"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {mockPlayers.map((player) => {
                  const sel = selectedIds.includes(player.id);
                  const maxed = !sel && selectedIds.length >= 5;
                  return (
                    <button
                      key={player.id}
                      onClick={() => !maxed && toggle(player.id)}
                      disabled={maxed}
                      className={cn(
                        "w-full glass-card p-4 flex items-center gap-3 text-left transition-all",
                        sel && "border border-neon-green/40 bg-green-500/5",
                        maxed && "opacity-40 cursor-not-allowed",
                        !sel && !maxed && "hover:border-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                        "bg-white/5 text-slate-300"
                      )}>
                        {player.primary_position}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{player.full_name}</p>
                        <p className="text-slate-500 text-xs">{player.team?.team_code}</p>
                      </div>
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                        sel ? "bg-neon-green/20 text-neon-green" : "bg-white/5 text-slate-500"
                      )}>
                        {sel ? <Minus size={14} /> : <Plus size={14} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={submit}
                disabled={!selectedIds.length || submitting}
                className="btn-primary w-full justify-center disabled:opacity-40"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin" />
                ) : (
                  <><Zap size={16} /> Lock In Picks ({selectedIds.length}/5)</>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-3">
          {!recentEntries.length ? (
            <div className="text-center py-12 text-slate-500">
              <Zap size={32} className="mx-auto mb-2 opacity-30" />
              <p>No history yet</p>
            </div>
          ) : recentEntries.map((entry) => (
            <div key={entry.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-medium text-sm">
                  {entry.bts_day?.date || "—"}
                </p>
                {entry.success === null && <span className="text-xs text-yellow-400">⏳ Pending</span>}
                {entry.success === true && (
                  <span className="flex items-center gap-1 text-xs text-neon-green">
                    <CheckCircle2 size={12} /> Success
                  </span>
                )}
                {entry.success === false && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle size={12} /> Failed
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {entry.picks.map((pick) => (
                  <span key={pick.player.id} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-slate-300">
                    {pick.player.full_name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard tab */}
      {tab === "leaderboard" && (
        <div>
          {!leaderboard.length ? (
            <div className="text-center py-12 text-slate-500">
              <Trophy size={32} className="mx-auto mb-2 opacity-30" />
              <p>No leaderboard data yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((entry, i) => (
                <div key={entry.user_id} className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                  entry.user_id === user?.id ? "bg-brand-500/10 border border-brand-400/30" : "bg-white/3 hover:bg-white/5 border border-transparent"
                )}>
                  <span className="text-slate-500 text-sm font-mono w-6 text-center">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">
                      {entry.display_name || "Unknown"}
                      {entry.user_id === user?.id && <span className="ml-2 text-xs text-brand-400">(You)</span>}
                    </p>
                    <p className="text-slate-500 text-xs">Best: {entry.longest_streak} days</p>
                  </div>
                  <div className="streak-badge">🔥 {entry.current_streak}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
