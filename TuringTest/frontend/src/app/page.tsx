"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { slatesApi, weeksApi, btsApi } from "@/lib/api";
import { formatDate, formatPoints, STATUS_COLORS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";
import GameCard from "@/components/ui/GameCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  TrendingUp, Zap, Trophy, Calendar, ArrowRight, Users,
  ChevronRight, Star,
} from "lucide-react";

interface Slate {
  id: number;
  slate_date: string;
  status: string;
  lock_time: string | null;
  games?: unknown[];
}

interface WeekData { id: number; week_index: number; season_year: number; status: string }
interface BTSState { current_streak: number; longest_streak: number }

export default function HomePage() {
  const [slate, setSlate] = useState<Slate | null>(null);
  const [week, setWeek] = useState<WeekData | null>(null);
  const [weekLeaders, setWeekLeaders] = useState<unknown[]>([]);
  const [btsState, setBtsState] = useState<BTSState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [slateRes, weekRes] = await Promise.allSettled([
          slatesApi.getToday(),
          weeksApi.getCurrent(),
        ]);

        if (slateRes.status === "fulfilled") setSlate(slateRes.value.data);
        if (weekRes.status === "fulfilled") {
          const w = weekRes.value.data;
          setWeek(w);
          const lb = await weeksApi.getLeaderboard(w.id);
          setWeekLeaders(lb.data.scores?.slice(0, 5) || []);
        }

        const btsRes = await btsApi.getMe().catch(() => null);
        if (btsRes?.data?.state) setBtsState(btsRes.data.state);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden mb-10 bg-hero-gradient bg-surface-800/40 border border-white/5 p-8 sm:p-12">
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <span className="text-surface-900 font-black text-xs">TT</span>
            </div>
            <span className="text-brand-400 text-sm font-medium tracking-wider uppercase">
              TuringLytics Platform
            </span>
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
          >
            Test Your
            <br />
            <span className="gradient-text">Baseball IQ</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mb-8">
            Build lineups, beat the streak, compete for prizes. The ultimate baseball prediction experience.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/slate" className="btn-primary text-sm px-6 py-3">
              Enter Today&apos;s Contest <ArrowRight size={16} />
            </Link>
            <Link href="/bts" className="btn-ghost border border-white/10 text-sm px-5 py-3 rounded-xl">
              Beat The Streak <Zap size={14} />
            </Link>
          </div>
        </div>

        {/* Decorative */}
        <div className="absolute right-0 top-0 bottom-0 hidden lg:flex items-center pr-12 opacity-20">
          <div className="text-[160px] font-black text-brand-400" style={{ fontFamily: "var(--font-display)" }}>
            ⚾
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Link href="/slate" className="glass-card-hover p-6 block group">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center mb-4">
            <TrendingUp size={20} className="text-brand-400" />
          </div>
          <h3 className="text-white font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Daily Fantasy
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Build a 6-player lineup under the salary cap. Score points in real time.
          </p>
          <div className="flex items-center gap-1 text-brand-400 text-sm font-medium">
            Play Now <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link href="/bts" className="glass-card-hover p-6 block group">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
            <Zap size={20} className="text-neon-green" />
          </div>
          <h3 className="text-white font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Beat The Streak
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Pick up to 5 players to record a hit. Keep your streak alive all season.
          </p>
          {btsState ? (
            <div className="streak-badge text-xs">🔥 {btsState.current_streak} day streak</div>
          ) : (
            <div className="flex items-center gap-1 text-neon-green text-sm font-medium">
              Start Streak <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </Link>

        <Link href="/lineups" className="glass-card-hover p-6 block group">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
            <Calendar size={20} className="text-purple-400" />
          </div>
          <h3 className="text-white font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Lineup Tracker
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Check confirmed lineups for all games. Know who&apos;s playing before you lock in.
          </p>
          <div className="flex items-center gap-1 text-purple-400 text-sm font-medium">
            View Lineups <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Bottom two-col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Slate */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="section-title">Today&apos;s Slate</h2>
            {slate && (
              <span className={cn(
                "text-xs px-2.5 py-1 rounded-lg border font-medium",
                STATUS_COLORS[slate.status] || STATUS_COLORS.scheduled
              )}>
                {slate.status.toUpperCase()}
              </span>
            )}
          </div>

          {loading ? <LoadingSpinner /> : !slate ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar size={32} className="mx-auto mb-2 opacity-30" />
              <p>No slate scheduled for today</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-slate-400 text-sm">{formatDate(slate.slate_date)}</p>
                {slate.lock_time && (
                  <p className="text-yellow-400 text-xs mt-0.5">
                    🔒 Locks at {new Date(slate.lock_time).toLocaleTimeString("en-US", {
                      hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              <Link href={`/slate/${slate.id}`} className="btn-primary w-full justify-center">
                <TrendingUp size={16} /> Enter Contest
              </Link>
            </>
          )}
        </div>

        {/* Weekly Leaderboard preview */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="section-title">Weekly Leaders</h2>
            {week && (
              <Link href="/leaderboard" className="text-brand-400 text-xs hover:text-brand-300 flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            )}
          </div>

          {loading ? <LoadingSpinner /> : !weekLeaders.length ? (
            <div className="text-center py-8 text-slate-500">
              <Trophy size={32} className="mx-auto mb-2 opacity-30" />
              <p>No scores yet this week</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(weekLeaders as { rank: number; user?: { display_name: string; id: string }; total_points: number; entries_count: number }[]).map((entry) => (
                <div key={entry.rank} className="flex items-center gap-3 py-2">
                  <span className="text-slate-500 text-sm font-mono w-6 text-center">{entry.rank}</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                      {entry.user?.display_name || "Unknown"}
                    </p>
                    <p className="text-slate-500 text-xs">{entry.entries_count} entries</p>
                  </div>
                  <span className="text-white font-mono font-bold text-sm">
                    {formatPoints(entry.total_points)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
