"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Target, ChevronLeft, Clock, Trophy, Plus, Trash2, AlertCircle, Lock } from "lucide-react";
import Link from "next/link";
import { fanGamesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type TargetStats = Record<string, number>;

interface SelectedPlayer {
  id: number | string;
  full_name: string;
  position: string;
  team: string;
  stats: Record<string, number>;
  season?: string;
}

interface PlayerOption {
  id: number | string;
  full_name: string;
  position: string;
  team: string;
  team_name: string;
  season?: string;
  stats: Record<string, number>;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  score: number;
  totals: Record<string, number>;
  selected_players: Array<{ full_name: string; position: string; stats: Record<string, number>; season?: string }>;
}

const STAT_LABELS: Record<string, string> = {
  HR: "Home Runs",
  H: "Hits",
  RBI: "RBI",
  SB: "Stolen Bases",
  R: "Runs",
  BB: "Walks",
  SO: "Strikeouts",
  "2B": "Doubles",
  "3B": "Triples",
  AVG: "Avg",
  OBP: "OBP",
};

const TIME_LIMIT = 300;

export default function TargetLinePage() {
  const { user } = useAuthStore();
  const [target, setTarget] = useState<TargetStats | null>(null);
  const [label, setLabel] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(15);
  const [selected, setSelected] = useState<SelectedPlayer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [gameState, setGameState] = useState<"idle" | "playing" | "done">("idle");
  const [finalScore, setFinalScore] = useState<{ score: number; totals: TargetStats } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<SelectedPlayer[]>([]);
  const submittedRef = useRef(false);
  const [timesUp, setTimesUp] = useState(false);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    fanGamesApi.targetToday().then((res) => {
      const data = res.data;
      const cdata = data.challenge?.challenge_data;
      if (cdata) {
        setTarget(cdata.target);
        setLabel(cdata.label || "");
        setMaxPlayers(cdata.max_players ?? 15);
      }
      const result = data.result;
      if (result?.completed) {
        setSubmitted(true);
        setGameState("done");
        const rdata = result.result_data;
        setFinalScore({ score: result.score, totals: rdata.totals });
        setSelected(rdata.selected_players || []);
      }
    }).catch(() => toast.error("Failed to load today's challenge")).finally(() => setLoading(false));
  }, []);

  // Live totals computation — dynamic based on whatever stats are in target
  const totals: TargetStats = selected.reduce<TargetStats>(
    (acc, p) => {
      for (const stat of Object.keys(target || {})) {
        acc[stat] = (acc[stat] || 0) + (p.stats[stat] || 0);
      }
      return acc;
    },
    {}
  );

  const startGame = () => {
    setGameState("playing");
    setTimeLeft(TIME_LIMIT);
    setTimesUp(false);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setTimesUp(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // Respond to timer expiry using ref to get fresh selected/submitted values
  useEffect(() => {
    if (timesUp) {
      setGameState("done");
      doSubmit();
    }
  }, [timesUp]);

  // Keep selectedRef and submittedRef in sync
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);

  const doSubmit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    if (!user) {
      toast.error("Sign in to save your result");
      return;
    }
    const sel = selectedRef.current;
    const useSelections = sel.length > 0 && sel.every((p) => p.season != null) && sel.some((p) => typeof p.id === "string");
    try {
      const res = useSelections
        ? await fanGamesApi.targetSubmitSelections(sel.map((p) => ({ player_id: String(p.id), season: p.season! })))
        : await fanGamesApi.targetSubmit(sel.map((p) => Number(p.id)));
      const data = res.data;
      setFinalScore({ score: data.score, totals: data.totals });
      toast.success(`Score: ${data.score.toFixed(1)}%`, { duration: 4000 });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to submit");
    }
  };

  const submitRoster = async () => {
    if (submitted) return;
    await doSubmit();
  };

  const handleLockIn = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState("done");
    doSubmit();
  };

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fanGamesApi.targetPlayers(searchQuery);
        setSearchResults(res.data);
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const addPlayer = (p: PlayerOption) => {
    if (selected.length >= maxPlayers) { toast.error(`Max ${maxPlayers} players`); return; }
    const alreadyAdded = p.season != null
      ? selected.some((s) => s.id === p.id && s.season === p.season)
      : selected.some((s) => s.id === p.id);
    if (alreadyAdded) { toast.error("Already added"); return; }
    setSelected((prev) => [...prev, { id: p.id, full_name: p.full_name, position: p.position, team: p.team ?? "", stats: p.stats ?? {}, season: p.season }]);
    setSearchQuery("");
  };

  const removePlayer = (item: SelectedPlayer) => {
    if (gameState === "done") return;
    setSelected((prev) =>
      prev.filter((p) => item.season != null
        ? !(p.id === item.id && p.season === item.season)
        : p.id !== item.id)
    );
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fanGamesApi.targetLeaderboard();
      setLeaderboard(res.data);
    } catch {}
  };

  const handleTabChange = (t: "play" | "leaderboard") => {
    setTab(t);
    if (t === "leaderboard") loadLeaderboard();
  };

  const getCloseness = (actual: number, tgt: number) => {
    if (tgt === 0) return 100;
    const diff = Math.abs(actual - tgt) / tgt;
    return Math.max(0, Math.round((1 - diff) * 100));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fan-games" className="btn-ghost text-sm px-2"><ChevronLeft size={16} /> Games</Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-slate-500"><Clock size={12} /> {today}</div>
      </div>

      <div className="page-header mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Target size={22} className="text-brand-300" />
          <h1 className="page-title">Target Line</h1>
          <span className="stat-pill bg-brand-500/20 text-brand-300 border border-brand-400/30 text-xs">Daily</span>
        </div>
        <p className="page-subtitle">Build a roster whose combined stats match the target. 5 minutes on the clock.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-surface-800/60 rounded-xl w-fit">
        {(["play", "leaderboard"] as const).map((t) => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t ? "bg-brand-500/20 text-brand-300" : "text-slate-400 hover:text-white")}>
            {t === "play" ? "Play" : <span className="flex items-center gap-1"><Trophy size={13} /> Leaderboard</span>}
          </button>
        ))}
      </div>

      {tab === "play" && (
        <>
          {/* Target card — hidden until game starts */}
          {target && gameState !== "idle" && (
            <div className="glass-card p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Today's Target</div>
                  <div className="text-base font-bold text-white">{label}</div>
                </div>
                {/* Timer */}
                {gameState === "playing" && (
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-lg border",
                    timeLeft <= 30
                      ? "text-red-400 border-red-500/30 bg-red-500/10"
                      : "text-brand-300 border-brand-400/30 bg-brand-500/10"
                  )}>
                    <Clock size={14} />
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(target).map(([stat, tgt]) => {
                  const actual = totals[stat] ?? 0;
                  const pct = getCloseness(actual, tgt);
                  return (
                    <div key={stat} className="bg-surface-900/60 rounded-xl p-3 border border-white/5">
                      <div className="text-xs text-slate-500 mb-1">{STAT_LABELS[stat] ?? stat}</div>
                      <div className="text-xl font-bold text-white font-mono">{tgt}</div>
                      {(gameState === "playing" || gameState === "done") && (
                        <>
                          <div className="text-xs text-slate-400 mt-1">
                            Yours: <span className={cn("font-semibold",
                              actual === tgt ? "text-neon-green" : actual > tgt ? "text-yellow-400" : "text-slate-300")}>
                              {actual}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-neon-green transition-all duration-300"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Idle state */}
          {gameState === "idle" && (
            <>
              {!user && (
                <div className="glass-card p-4 mb-4 flex items-center gap-3 border-brand-400/20">
                  <AlertCircle size={16} className="text-brand-300 shrink-0" />
                  <p className="text-sm text-slate-300">
                    <Link href="/auth/login" className="text-brand-300 hover:underline font-medium">Sign in</Link>{" "}
                    to save your score and appear on the leaderboard.
                  </p>
                </div>
              )}
              <div className="text-center py-6">
                <p className="text-slate-400 text-sm mb-4">
                  You have 5 minutes to build a roster of ALPB players.
                  Pick a season for each player; combined stats should match the target line.
                </p>
                <button onClick={startGame} className="btn-primary px-8">
                  Start — 5:00 Clock
                </button>
              </div>
            </>
          )}

          {/* Playing state */}
          {gameState === "playing" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="glass-card p-4">
                <label className="text-xs text-slate-500 mb-2 block">
                  Add player ({selected.length}/{maxPlayers} selected)
                </label>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search player name..."
                  className="input-field mb-3"
                />
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {searching && <div className="text-center py-3 text-slate-500 text-sm">Searching...</div>}
                  {searchResults.map((p) => {
                    const isAdded = p.season != null
                      ? selected.some((s) => s.id === p.id && s.season === p.season)
                      : selected.some((s) => s.id === p.id);
                    return (
                      <button
                        key={`${p.id}-${p.season ?? ""}`}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); if (!isAdded) addPlayer(p); }}
                        disabled={isAdded}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                          isAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5 cursor-pointer"
                        )}
                      >
                        <div className={cn("position-badge text-xs",
                          p.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                          {p.position}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium">
                            {p.full_name}{p.season ? ` (${String(p.season).match(/\d{4}/)?.[0] ?? p.season})` : ""}
                          </div>
                          <div className="text-xs text-slate-500">{p.team_name}</div>
                        </div>
                        <div className="flex gap-2 text-xs text-slate-400">
                          {Object.keys(target || {}).map((stat) => (
                            <span key={stat}>{stat}:{p.stats?.[stat] ?? 0}</span>
                          ))}
                        </div>
                        {isAdded ? <span className="text-xs text-slate-600">added</span> : <Plus size={14} className="text-slate-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Roster */}
              {selected.length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-xs text-slate-500 uppercase tracking-widest mb-3">Your Roster</h3>
                  <div className="space-y-2">
                    {selected.map((p) => (
                      <div key={`${p.id}-${p.season ?? ""}`} className="flex items-center gap-3 py-1.5">
                        <div className={cn("position-badge text-xs",
                          p.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                          {p.position || "-"}
                        </div>
                        <div className="flex-1 text-sm text-white">{p.full_name}{p.season ? ` (${String(p.season).match(/\d{4}/)?.[0] ?? p.season})` : ""}</div>
                        <div className="flex gap-2 text-xs text-slate-400">
                          {Object.keys(target || {}).map((stat) => (
                            <span key={stat}>{stat}:{p.stats[stat] || 0}</span>
                          ))}
                        </div>
                        <button onClick={() => removePlayer(p)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handleLockIn} className="w-full btn-primary flex items-center justify-center gap-2">
                <Lock size={14} /> Lock In My Roster
              </button>
            </div>
          )}

          {/* Done state */}
          {gameState === "done" && (
            <div className="space-y-4">
              {/* Score */}
              {finalScore && (
                <div className="glass-card p-6 text-center border border-brand-400/20">
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Closeness Score</div>
                  <div className="text-5xl font-black text-white font-mono mb-1">
                    <span className="gradient-text">{finalScore.score.toFixed(1)}</span>
                    <span className="text-2xl text-slate-400">%</span>
                  </div>
                  <div className="text-xs text-slate-500">Higher is better • 100% = perfect match</div>
                </div>
              )}

              {/* Roster */}
              {selected.length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-xs text-slate-500 uppercase tracking-widest mb-3">Your Final Roster</h3>
                  <div className="space-y-2">
                    {selected.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 py-1">
                        <div className={cn("position-badge text-xs",
                          p.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                          {p.position}
                        </div>
                        <div className="flex-1 text-sm text-white">{p.full_name}</div>
                        <div className="flex gap-2 text-xs text-slate-400">
                          {Object.keys(target || {}).map((stat) => (
                            <span key={stat}>{stat}:{p.stats[stat] || 0}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* Totals row */}
                    {finalScore && (
                      <div className="flex items-center gap-3 py-1.5 pt-2 border-t border-white/5">
                        <div className="text-xs text-slate-500 font-semibold w-8">TOT</div>
                        <div className="flex-1 text-xs text-slate-400">Combined</div>
                        <div className="flex gap-2 text-xs font-semibold text-white">
                          {Object.entries(finalScore.totals).map(([stat, val]) => (
                            <span key={stat}>{val} {stat}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-center text-xs text-slate-500 mt-2">Come back tomorrow for a new target!</div>
            </div>
          )}
        </>
      )}

      {tab === "leaderboard" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Today's Leaderboard</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click a row to see their roster</p>
          </div>
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No submissions yet today.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {leaderboard.map((entry) => (
                <div key={entry.rank}>
                  <button
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    onClick={() => setExpandedEntry(expandedEntry === entry.rank ? null : entry.rank)}
                  >
                    <div className={cn("rank-badge shrink-0", entry.rank <= 3 ? `rank-${entry.rank}` : "bg-white/5 text-slate-400")}>
                      {entry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{entry.display_name}</div>
                      {entry.totals && (
                        <div className="text-xs text-slate-500">
                          {Object.entries(entry.totals).map(([s, v]) => `${v} ${s}`).join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="text-neon-green font-mono font-bold text-sm shrink-0">{entry.score.toFixed(1)}%</div>
                  </button>
                  {expandedEntry === entry.rank && entry.selected_players?.length > 0 && (
                    <div className="px-4 pb-3 bg-white/[0.02] border-t border-white/5">
                      <div className="space-y-1.5 pt-2">
                        {entry.selected_players.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 py-1">
                            <div className={cn("position-badge text-xs shrink-0",
                              p.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                              {p.position || "—"}
                            </div>
                            <div className="flex-1 text-sm text-slate-300 min-w-0 truncate">
                              {p.full_name}
                              {p.season && <span className="text-slate-500 ml-1">({String(p.season).match(/\d{4}/)?.[0] ?? p.season})</span>}
                            </div>
                            <div className="flex gap-2 text-xs text-slate-400 shrink-0">
                              {Object.keys(target || {}).map((stat) => (
                                <span key={stat}>{stat}:{p.stats?.[stat] ?? 0}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {entry.totals && (
                          <div className="flex items-center gap-3 py-1 pt-2 border-t border-white/5">
                            <div className="text-xs text-slate-500 font-semibold w-8 shrink-0">TOT</div>
                            <div className="flex-1" />
                            <div className="flex gap-2 text-xs font-semibold text-white shrink-0">
                              {Object.entries(entry.totals).map(([stat, val]) => (
                                <span key={stat}>{val} {stat}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
