"use client";

import { useEffect, useState } from "react";
import { weeksApi, btsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn, formatPoints } from "@/lib/utils";
import LeaderboardTable from "@/components/ui/LeaderboardTable";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Trophy, Zap, TrendingUp, Crown } from "lucide-react";

type Tab = "weekly" | "bts";

interface WeekInfo {
  id: number;
  week_index: number;
  season_year: number;
  start_date: string;
  end_date: string;
}

interface BTSLeaderEntry {
  user_id: string;
  display_name: string | null;
  current_streak: number;
  longest_streak: number;
}

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("weekly");
  const [week, setWeek] = useState<WeekInfo | null>(null);
  const [weekEntries, setWeekEntries] = useState<unknown[]>([]);
  const [btsEntries, setBtsEntries] = useState<BTSLeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const [weekRes, btsRes] = await Promise.allSettled([
          weeksApi.getCurrent(),
          btsApi.getLeaderboard(),
        ]);

        if (btsRes.status === "fulfilled") setBtsEntries(btsRes.value.data);

        if (weekRes.status === "fulfilled") {
          const w = weekRes.value.data;
          setWeek(w);
          const lb = await weeksApi.getLeaderboard(w.id, page);
          setWeekEntries(lb.data.scores || []);
          setTotalPages(lb.data.pages || 1);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Trophy size={20} className="text-neon-gold" />
          </div>
          <div>
            <h1 className="page-title">Leaderboard</h1>
            <p className="page-subtitle">
              {week ? `Week ${week.week_index} · ${week.season_year}` : "Current standings"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl border border-white/5 mb-6">
        <button
          onClick={() => setTab("weekly")}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5",
            tab === "weekly" ? "bg-surface-700 text-white" : "text-slate-400 hover:text-white"
          )}
        >
          <TrendingUp size={14} /> Weekly DFS
        </button>
        <button
          onClick={() => setTab("bts")}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5",
            tab === "bts" ? "bg-surface-700 text-white" : "text-slate-400 hover:text-white"
          )}
        >
          <Zap size={14} /> Beat The Streak
        </button>
      </div>

      {loading ? (
        <LoadingSpinner className="py-16" />
      ) : tab === "weekly" ? (
        <>
          {week && (
            <div className="glass-card p-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">
                  Week {week.week_index} · {week.season_year} Season
                </p>
                <p className="text-slate-400 text-sm">
                  {new Date(week.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                  {new Date(week.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <Crown size={20} className="text-neon-gold" />
            </div>
          )}

          {!week ? (
            <div className="text-center py-12 text-slate-500">
              <Trophy size={40} className="mx-auto mb-3 opacity-30" />
              <p>No active week found</p>
            </div>
          ) : (
            <>
              <LeaderboardTable
                entries={weekEntries as Parameters<typeof LeaderboardTable>[0]["entries"]}
                highlightUserId={user?.id}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-ghost border border-white/10 rounded-xl px-4 py-2 text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-slate-400 text-sm">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-ghost border border-white/10 rounded-xl px-4 py-2 text-sm disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* BTS Leaderboard */
        <div className="space-y-1.5">
          {!btsEntries.length ? (
            <div className="text-center py-12 text-slate-500">
              <Zap size={40} className="mx-auto mb-3 opacity-30" />
              <p>No streak data yet</p>
            </div>
          ) : btsEntries.map((entry, i) => (
            <div
              key={entry.user_id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                entry.user_id === user?.id
                  ? "bg-brand-500/10 border-brand-400/30"
                  : "bg-white/3 border-transparent hover:bg-white/5"
              )}
            >
              <span className="text-slate-500 text-sm font-mono w-6 text-center">{i + 1}</span>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">
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
  );
}
