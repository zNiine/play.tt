"use client";

import { useState, useEffect, useRef } from "react";
import { Grid3X3, X, Check, Clock, Trophy, ChevronLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { fanGamesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface GridChallenge {
  id: number;
  date: string;
  game_type: string;
  challenge_data: {
    rows: string[];
    cols: string[];
    row_labels: Record<string, string>;
    col_labels: Record<string, string>;
    max_misses: number;
  };
}

interface CellState {
  player_id?: string;
  player_name?: string;
  correct: boolean;
  attempted: boolean;
}

interface PlayerOption {
  id: string; // data.db player_id (string)
  full_name: string;
  position: string;
  team: string;
  team_name: string;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  correct: number;
  misses: number;
  score: number;
}

export default function ImmaculateGridPage() {
  const { user } = useAuthStore();
  const [challenge, setChallenge] = useState<GridChallenge | null>(null);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [misses, setMisses] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]> | null>(null);
  const [pickPct, setPickPct] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    fanGamesApi.gridToday().then((res) => {
      setChallenge(res.data.challenge);
      const result = res.data.result;
      if (result) {
        const rdata = result.result_data;
        setCells(
          Object.fromEntries(
            Object.entries(rdata.picks || {}).map(([k, v]: [string, any]) => [
              k,
              { player_id: String(v.player?.id ?? ""), player_name: v.player?.full_name, correct: v.correct, attempted: true },
            ])
          )
        );
        setMisses(rdata.misses || 0);
        setCorrect(rdata.correct || 0);
        setCompleted(result.completed);
      }
      if (res.data.pick_pct) setPickPct(res.data.pick_pct);
    }).catch((err: any) => {
      const msg = err.response?.status === 503 ? "Today's grid isn't ready yet. Run the daily schedule (4 AM) or ensure you have players and teams in the database." : "Failed to load today's grid";
      toast.error(msg);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeCell) setTimeout(() => searchRef.current?.focus(), 100);
  }, [activeCell]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fanGamesApi.playerSearch(searchQuery);
        setSearchResults(res.data);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleCellClick = (row: number, col: number) => {
    if (completed || !user) return;
    const key = `${row},${col}`;
    if (cells[key]?.correct) return;
    setActiveCell([row, col]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handlePlayerSelect = async (player: PlayerOption) => {
    if (!activeCell || !challenge) return;
    const [row, col] = activeCell;
    setActiveCell(null);

    if (!user) { toast.error("Sign in to play"); return; }

    try {
      const res = await fanGamesApi.gridGuess({ row, col, player_id: String(player.id) });
      const data = res.data;
      const key = `${row},${col}`;

      if (data.valid) {
        setCells((prev) => ({
          ...prev,
          [key]: { player_id: String(player.id), player_name: player.full_name, correct: true, attempted: true },
        }));
        toast.success(`${player.full_name} is correct!`);
      } else {
        setCells((prev) => ({
          ...prev,
          [key]: { ...prev[key], attempted: true, correct: false },
        }));
        toast.error(`${player.full_name} doesn't fit that square`);
      }

      setMisses(data.misses);
      setCorrect(data.correct);
      setCompleted(data.completed);

      if (data.completed) {
        toast.success(data.correct === 9 ? "Perfect grid! 🎉" : "Game over!", { duration: 4000 });
        if (data.correct > 0) {
          try {
            const [todayRes, ansRes] = await Promise.all([fanGamesApi.gridToday(), fanGamesApi.gridAnswers()]);
            if (todayRes.data.pick_pct) setPickPct(todayRes.data.pick_pct);
            if (ansRes.data.answers) setAnswers(ansRes.data.answers);
            if (ansRes.data.pick_pct) setPickPct((p) => ({ ...p, ...ansRes.data.pick_pct }));
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error submitting guess");
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fanGamesApi.gridLeaderboard();
      setLeaderboard(res.data);
    } catch {}
  };

  const handleTabChange = (t: "play" | "leaderboard") => {
    setTab(t);
    if (t === "leaderboard") loadLeaderboard();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const rows = challenge?.challenge_data?.rows || [];
  const cols = challenge?.challenge_data?.cols || [];
  const rowLabels = challenge?.challenge_data?.row_labels || {};
  const colLabels = challenge?.challenge_data?.col_labels || {};
  const maxMisses = challenge?.challenge_data?.max_misses || 9;
  const totalCells = rows.length * cols.length;

  if (!loading && !challenge) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/fan-games" className="btn-ghost text-sm px-2"><ChevronLeft size={16} /> Games</Link>
        </div>
        <div className="glass-card p-8 text-center">
          <p className="text-slate-400 mb-2">Today&apos;s grid isn&apos;t available yet.</p>
          <p className="text-sm text-slate-500">Ensure the daily schedule has run (4 AM UTC) and that players and teams exist in the database.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fan-games" className="btn-ghost text-sm px-2">
          <ChevronLeft size={16} /> Games
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={12} /> {today}
        </div>
      </div>

      <div className="page-header mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Grid3X3 size={22} className="text-brand-300" />
          <h1 className="page-title">Immaculate Grid</h1>
          <span className="stat-pill bg-brand-500/20 text-brand-300 border border-brand-400/30 text-xs">Daily</span>
        </div>
        <p className="page-subtitle">Name a player who fits both the row and column category.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-surface-800/60 rounded-xl w-fit">
        {(["play", "leaderboard"] as const).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t ? "bg-brand-500/20 text-brand-300" : "text-slate-400 hover:text-white"
            )}
          >
            {t === "play" ? "Play" : <span className="flex items-center gap-1"><Trophy size={13} /> Leaderboard</span>}
          </button>
        ))}
      </div>

      {tab === "play" && (
        <>
          {/* Status bar */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-1.5 text-sm">
              <Check size={14} className="text-neon-green" />
              <span className="text-white font-semibold">{correct}</span>
              <span className="text-slate-500">/ {totalCells} correct</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <X size={14} className="text-red-400" />
              <span className="text-white font-semibold">{misses}</span>
              <span className="text-slate-500">/ {maxMisses} misses</span>
            </div>
            {completed && (
              <span className={cn(
                "stat-pill text-xs",
                correct === totalCells
                  ? "bg-neon-green/10 border border-neon-green/30 text-neon-green"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              )}>
                {correct === totalCells ? "Complete!" : "Game Over"}
              </span>
            )}
          </div>

          {!user && (
            <div className="glass-card p-4 mb-4 flex items-center gap-3 border-brand-400/20">
              <AlertCircle size={16} className="text-brand-300 shrink-0" />
              <p className="text-sm text-slate-300">
                <Link href="/auth/login" className="text-brand-300 hover:underline font-medium">Sign in</Link>{" "}
                to save your progress and appear on the leaderboard.
              </p>
            </div>
          )}

          {/* Grid */}
          <div className="glass-card p-4 overflow-x-auto">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `140px repeat(${cols.length}, 1fr)` }}
            >
              {/* Top-left empty corner */}
              <div className="h-16" />

              {/* Column headers */}
              {cols.map((col) => (
                <div
                  key={col}
                  className="h-16 flex items-center justify-center text-center px-2"
                >
                  <span className="text-xs font-semibold text-brand-300 leading-tight">
                    {colLabels[col] || col}
                  </span>
                </div>
              ))}

              {/* Rows */}
              {rows.map((row, ri) => (
                <>
                  {/* Row header */}
                  <div key={`row-${ri}`} className="flex items-center justify-end pr-3 h-20">
                    <span className="text-xs font-semibold text-brand-300 text-right leading-tight">
                      {rowLabels[row] || row}
                    </span>
                  </div>

                  {/* Cells */}
                  {cols.map((col, ci) => {
                    const key = `${ri},${ci}`;
                    const cell = cells[key];
                    const isActive = activeCell?.[0] === ri && activeCell?.[1] === ci;

                    return (
                      <button
                        key={key}
                        onClick={() => handleCellClick(ri, ci)}
                        disabled={completed || cell?.correct}
                        className={cn(
                          "h-20 rounded-xl border transition-all duration-200 flex items-center justify-center text-center p-2 text-xs font-medium",
                          cell?.correct
                            ? "bg-neon-green/10 border-neon-green/30 text-neon-green cursor-default"
                            : isActive
                            ? "bg-brand-500/20 border-brand-400/50 text-white"
                            : "bg-surface-900/60 border-white/10 text-slate-400 hover:border-brand-400/30 hover:text-white hover:bg-brand-500/5"
                        )}
                      >
                        {cell?.correct ? (
                          <div className="space-y-0.5">
                            <Check size={14} className="mx-auto mb-0.5" />
                            <div className="leading-tight">{cell.player_name}</div>
                            {pickPct[key] != null && (
                              <div className="text-[10px] text-slate-400 font-mono">{pickPct[key]}%</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">+</span>
                        )}
                      </button>
                    );
                  })}
                </>
              ))}
            </div>
          </div>

          {/* Reveal answers (post-game) */}
          {completed && answers && (
            <div className="glass-card p-4 mt-4">
              <h3 className="text-sm font-semibold text-white mb-3">Valid Answers</h3>
              <div
                className="grid gap-2 text-xs"
                style={{ gridTemplateColumns: `100px repeat(${cols.length}, 1fr)` }}
              >
                <div />
                {cols.map((c) => (
                  <div key={c} className="text-brand-300 font-medium text-center">{colLabels[c]}</div>
                ))}
                {rows.map((r, ri) => (
                  <>
                    <div key={`al-${ri}`} className="text-brand-300 font-medium flex items-center justify-end pr-2">{rowLabels[r]}</div>
                    {cols.map((c, ci) => {
                      const key = `${ri},${ci}`;
                      const names = answers[key] || [];
                      return (
                        <div key={key} className="bg-surface-900/60 rounded-lg p-2 space-y-0.5">
                          {names.length ? names.map((n) => (
                            <div key={n} className="text-slate-300">{n}</div>
                          )) : <div className="text-slate-600 italic">None found</div>}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          )}

          {/* Completed but no answers yet (hasn't played) */}
          {completed && !answers && correct === 0 && (
            <div className="glass-card p-4 mt-4 text-center">
              <p className="text-slate-400 text-sm">Come back tomorrow for a new grid!</p>
            </div>
          )}
        </>
      )}

      {tab === "leaderboard" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Today's Leaderboard</h3>
          </div>
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No completions yet today.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {leaderboard.map((entry) => (
                <div key={entry.rank} className="flex items-center gap-4 px-4 py-3">
                  <div className={cn("rank-badge", entry.rank <= 3 ? `rank-${entry.rank}` : "bg-white/5 text-slate-400")}>
                    {entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{entry.display_name}</div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div className="text-neon-green font-mono font-bold">{entry.correct}/9</div>
                    <div>{entry.misses} misses</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Player search modal */}
      {activeCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActiveCell(null)}>
          <div className="w-full max-w-md glass-card p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold text-sm">
                  {rowLabels[rows[activeCell[0]]]} × {colLabels[cols[activeCell[1]]]}
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">Name a player who fits both</p>
              </div>
              <button onClick={() => setActiveCell(null)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player name..."
              className="input-field mb-3"
            />

            <div className="space-y-1 max-h-60 overflow-y-auto">
              {searching && (
                <div className="text-center py-4 text-slate-500 text-sm">Searching...</div>
              )}
              {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="text-center py-4 text-slate-500 text-sm">No players found</div>
              )}
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handlePlayerSelect(p); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
                >
                  <div className={cn(
                    "position-badge text-xs",
                    p.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300"
                  )}>
                    {p.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{p.full_name}</div>
                    <div className="text-xs text-slate-500">{p.team_name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
