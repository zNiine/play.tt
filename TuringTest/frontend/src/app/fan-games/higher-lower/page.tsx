"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowUpDown, ChevronLeft, Trophy, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import Link from "next/link";
import { fanGamesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface PlayerData {
  id: number;
  full_name: string;
  team: string;
  team_name: string;
  position: string;
  season?: string | null;
  season_year?: number | null;
  value?: number;
}

interface Pair {
  stat_key: string;
  stat_label: string;
  player_a: PlayerData & { value: number };
  player_b: PlayerData;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  best_streak: number;
}

interface SeasonOption {
  season: string;
  year: number | null;
}

const TIMER_SECONDS = 15;

export default function HigherLowerPage() {
  const { user } = useAuthStore();
  const [gameState, setGameState] = useState<"idle" | "playing" | "result">("idle");
  const [pair, setPair] = useState<Pair | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [answered, setAnswered] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean; value_b: number; correct_answer: string; historical_pct: number | null } | null>(null);
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ correct: boolean; text: string } | null>(null);
  const [availableSeasons, setAvailableSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]); // empty = all
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fanGamesApi.higherLowerSeasons().then((res) => {
      setAvailableSeasons(res.data || []);
    }).catch(() => {});
  }, []);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const loadPair = useCallback(async (seasons?: string[]) => {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fanGamesApi.higherLowerPair(seasons && seasons.length ? seasons : undefined);
      setPair(res.data);
      setAnswered(false);
    } catch (err: any) {
      const msg = err.response?.status === 503
        ? "Not enough player data. Ensure game stats exist in the database."
        : "Failed to load next pair";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const streakRef = useRef(0);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  const [timedOut, setTimedOut] = useState(false);

  const startTimer = useCallback(() => {
    clearTimer();
    setTimeLeft(TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearTimer();
          setTimedOut(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (timedOut) {
      setTimedOut(false);
      endGame();
    }
  }, [timedOut]);

  const startGame = async () => {
    setStreak(0);
    streakRef.current = 0;
    setGameState("playing");
    await loadPair(selectedSeasons);
    startTimer();
  };

  const endGame = useCallback(async () => {
    clearTimer();
    setGameState("result");
    const finalStreak = streakRef.current;
    if (user && finalStreak > 0) {
      try {
        const res = await fanGamesApi.higherLowerScore(finalStreak);
        setBestStreak(res.data.best_streak);
      } catch {}
    }
  }, [user]);

  const handleAnswer = async (answer: "higher" | "lower") => {
    if (!pair || answered) return;
    clearTimer();
    setAnswered(true);
    setBannerMsg(null);

    try {
      const res = await fanGamesApi.higherLowerAnswer({
        player_a_id: pair.player_a.id,
        player_b_id: pair.player_b.id,
        stat_key: pair.stat_key,
        answer,
        season_a: pair.player_a.season ?? null,
        season_b: pair.player_b.season ?? null,
      });
      const data = res.data;
      setLastResult({ correct: data.correct, value_b: data.value_b, correct_answer: data.correct_answer, historical_pct: data.historical_pct ?? null });
      setBannerMsg({
        correct: data.correct,
        text: data.historical_pct !== null
          ? `${data.historical_pct}% of players got this right`
          : "You are the first to answer this matchup!",
      });

      if (data.correct) {
        const newStreak = streakRef.current + 1;
        streakRef.current = newStreak;
        setStreak(newStreak);
        setBestStreak((prev) => Math.max(prev, newStreak));
        setTimeout(async () => {
          await loadPair(selectedSeasons);
          startTimer();
        }, 2500);
      } else {
        setTimeout(() => endGame(), 1800);
      }
    } catch {
      toast.error("Error checking answer");
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fanGamesApi.higherLowerLeaderboard();
      setLeaderboard(res.data);
    } catch {}
  };

  const handleTabChange = (t: "play" | "leaderboard") => {
    setTab(t);
    if (t === "leaderboard") loadLeaderboard();
  };

  const toggleSeason = (season: string) => {
    setSelectedSeasons((prev) =>
      prev.includes(season) ? prev.filter((s) => s !== season) : [...prev, season]
    );
  };

  const allSelected = selectedSeasons.length === 0;
  const timerPct = (timeLeft / TIMER_SECONDS) * 100;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fan-games" className="btn-ghost text-sm px-2"><ChevronLeft size={16} /> Games</Link>
        <div className="flex-1" />
        {gameState === "playing" && streak > 0 && (
          <div className="streak-badge">{streak} 🔥</div>
        )}
      </div>

      <div className="page-header mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ArrowUpDown size={22} className="text-brand-300" />
          <h1 className="page-title">Higher or Lower</h1>
          <span className="stat-pill bg-neon-green/10 text-neon-green border border-neon-green/30 text-xs">Unlimited</span>
        </div>
        <p className="page-subtitle">Is the second player's stat higher or lower? Keep the streak alive.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-surface-800/60 rounded-xl w-fit">
        {(["play", "leaderboard"] as const).map((t) => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === t ? "bg-brand-500/20 text-brand-300" : "text-slate-400 hover:text-white")}>
            {t === "play" ? "Play" : <span className="flex items-center gap-1"><Trophy size={13} /> All-Time Board</span>}
          </button>
        ))}
      </div>

      {tab === "play" && (
        <>
          {/* Idle */}
          {gameState === "idle" && (
            <div className="glass-card p-8 text-center">
              <div className="text-5xl mb-4">⚾</div>
              <h2 className="text-xl font-bold text-white mb-2">Ready to play?</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                Two ALPB players appear. Guess if the second player's stat is higher or lower.
                You have {TIMER_SECONDS} seconds per round.
              </p>

              {/* Season filter */}
              {availableSeasons.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Filter by season</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => setSelectedSeasons([])}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        allSelected
                          ? "bg-brand-500/30 border-brand-400/50 text-brand-200"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      )}
                    >
                      All Years
                    </button>
                    {availableSeasons.map((s) => {
                      const active = selectedSeasons.includes(s.season);
                      return (
                        <button
                          key={s.season}
                          onClick={() => toggleSeason(s.season)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                            active
                              ? "bg-brand-500/30 border-brand-400/50 text-brand-200"
                              : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                          )}
                        >
                          {s.year ?? s.season}
                        </button>
                      );
                    })}
                  </div>
                  {!allSelected && (
                    <p className="text-xs text-slate-500 mt-2">
                      {selectedSeasons.length} season{selectedSeasons.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}

              <button onClick={startGame} className="btn-primary px-8">Start Game</button>
            </div>
          )}

          {/* Playing */}
          {gameState === "playing" && pair && (
            <div className="space-y-4">
              {/* Timer bar */}
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-1000",
                    timeLeft <= 5 ? "bg-red-500" : "bg-gradient-to-r from-brand-400 to-neon-green")}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Streak: <span className="text-white font-bold">{streak}</span></span>
                <span className={cn("font-mono font-bold", timeLeft <= 5 ? "text-red-400" : "text-slate-300")}>
                  {timeLeft}s
                </span>
              </div>

              {/* Stat label */}
              <div className="text-center">
                <span className="stat-pill bg-brand-500/20 border border-brand-400/30 text-brand-300 text-sm">
                  {pair.stat_label}
                </span>
              </div>

              {/* Player A */}
              <div className="glass-card p-5">
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3 text-center">Player A</div>
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold",
                    pair.player_a.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                    {pair.player_a.position}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-lg leading-tight">{pair.player_a.full_name}</div>
                    <div className="text-slate-500 text-sm">
                      {pair.player_a.team_name}
                      {pair.player_a.season_year && (
                        <span className="ml-1.5 text-slate-600">· {pair.player_a.season_year}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-xs mb-0.5">{pair.stat_label}</div>
                    <div className="text-3xl font-black font-mono text-brand-300">{pair.player_a.value}</div>
                  </div>
                </div>
              </div>

              {/* VS */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-slate-500 font-bold">VS</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Player B */}
              <div className={cn("glass-card p-5 transition-all duration-300",
                lastResult && (lastResult.correct ? "border-neon-green/40" : "border-red-500/30"))}>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-3 text-center">Player B</div>
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold",
                    pair.player_b.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                    {pair.player_b.position}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-lg leading-tight">{pair.player_b.full_name}</div>
                    <div className="text-slate-500 text-sm">
                      {pair.player_b.team_name}
                      {pair.player_b.season_year && (
                        <span className="ml-1.5 text-slate-600">· {pair.player_b.season_year}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-xs mb-0.5">{pair.stat_label}</div>
                    {lastResult ? (
                      <div className={cn("text-3xl font-black font-mono", lastResult.correct ? "text-neon-green" : "text-red-400")}>
                        {lastResult.value_b}
                      </div>
                    ) : (
                      <div className="text-3xl font-black font-mono text-slate-600">?</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Buttons — only shown when answered=false AND new pair has loaded */}
              {!answered && !loading && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAnswer("higher")}
                    className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 hover:border-neon-green/50"
                  >
                    <ChevronUp size={18} /> Higher
                  </button>
                  <button
                    onClick={() => handleAnswer("lower")}
                    className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                  >
                    <ChevronDown size={18} /> Lower
                  </button>
                </div>
              )}

              {answered && lastResult && (
                <div className={cn("text-center py-3 px-4 rounded-xl font-semibold text-sm space-y-1",
                  lastResult.correct ? "bg-neon-green/10 text-neon-green" : "bg-red-500/10 text-red-400")}>
                  <div>
                    {lastResult.correct
                      ? `✓ Correct! ${lastResult.correct_answer === "higher" ? "↑" : "↓"} Next round...`
                      : `✗ Wrong! It was ${lastResult.value_b} (${lastResult.correct_answer})`}
                  </div>
                  {bannerMsg && (
                    <div className="text-xs font-normal opacity-75">{bannerMsg.text}</div>
                  )}
                </div>
              )}

              {!answered && bannerMsg && (
                <div className={cn("text-center py-2 px-4 rounded-xl text-xs font-normal opacity-75",
                  bannerMsg.correct ? "bg-neon-green/10 text-neon-green" : "bg-red-500/10 text-red-400")}>
                  {bannerMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {gameState === "result" && (
            <div className="glass-card p-8 text-center">
              <div className="text-4xl mb-2">🏏</div>
              <h2 className="text-2xl font-black text-white mb-1">Game Over</h2>
              <div className="text-5xl font-black font-mono mb-2">
                <span className="gradient-text">{streak}</span>
              </div>
              <div className="text-slate-400 text-sm mb-1">
                {streak === 1 ? "1 correct answer" : `${streak} correct answers`}
              </div>
              {bestStreak > 0 && (
                <div className="text-xs text-slate-500 mb-6">
                  Your best: <span className="text-white font-bold">{bestStreak}</span>
                </div>
              )}

              {!user && (
                <p className="text-xs text-slate-500 mb-4">
                  <Link href="/auth/login" className="text-brand-300 hover:underline">Sign in</Link> to save your streak to the leaderboard.
                </p>
              )}

              <button onClick={startGame} className="btn-primary px-8 flex items-center gap-2 mx-auto">
                <RotateCcw size={14} /> Play Again
              </button>
            </div>
          )}
        </>
      )}

      {tab === "leaderboard" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">All-Time Best Streaks</h3>
          </div>
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No scores yet. Be the first!</div>
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
                  <div className="streak-badge text-sm">{entry.best_streak} 🔥</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
