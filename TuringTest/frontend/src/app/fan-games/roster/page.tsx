"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Users, ChevronLeft, Clock, Trophy, AlertCircle, Check, X } from "lucide-react";
import Link from "next/link";
import { fanGamesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface RosterChallenge {
  team_code: string;
  team_name: string;
  season?: number;
  player_count: number;
}

interface GuessResult {
  matched: boolean;
  player_name?: string;
  already_found?: boolean;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  found: number;
  total: number;
  score: number;
}

const TIMER_SECONDS = 120;

export default function RosterPage() {
  const { user } = useAuthStore();
  const [challenge, setChallenge] = useState<RosterChallenge | null>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "done">("idle");
  const [input, setInput] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [misses, setMisses] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [revealedRoster, setRevealedRoster] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timesUpRef = useRef(false);
  const foundRef = useRef<string[]>([]);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  useEffect(() => { foundRef.current = found; }, [found]);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const endGame = useCallback(async (auto = false) => {
    clearTimer();
    setGameState("done");
    try {
      const res = await fanGamesApi.rosterComplete();
      setRevealedRoster(res.data.roster || []);
      if (res.data.completed) setCompleted(true);
    } catch {}
    if (auto) toast("Time's up!", { icon: "⏱" });
  }, []);

  const [timesUp, setTimesUp] = useState(false);
  useEffect(() => {
    if (timesUp) { setTimesUp(false); endGame(true); }
  }, [timesUp, endGame]);

  useEffect(() => {
    fanGamesApi.rosterToday().then((res) => {
      const data = res.data;
      const cdata = data.challenge?.challenge_data || {};
      setChallenge({
        team_code: cdata.team_code,
        team_name: cdata.team_name,
        season: cdata.season,
        player_count: cdata.player_count ?? 0,
      });
      const result = data.result;
      if (result) {
        const rdata = result.result_data || {};
        setFound(rdata.found || []);
        foundRef.current = rdata.found || [];
        if (result.completed) {
          setCompleted(true);
          setGameState("done");
          fanGamesApi.rosterComplete().then((r) => setRevealedRoster(r.data.roster || [])).catch(() => {});
        }
      }
    }).catch(() => toast.error("Failed to load today's roster")).finally(() => setLoading(false));
  }, []);

  const startGame = () => {
    setGameState("playing");
    setTimeLeft(TIMER_SECONDS);
    timesUpRef.current = false;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearTimer();
          setTimesUp(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => () => clearTimer(), []);

  const handleGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = input.trim();
    if (!name || submitting || gameState !== "playing") return;
    setInput("");
    setSubmitting(true);
    try {
      const res = await fanGamesApi.rosterGuess(name);
      const data: GuessResult = res.data;
      if (data.already_found) {
        toast("Already found!", { icon: "✓" });
      } else if (data.matched && data.player_name) {
        setFound((prev) => {
          const next = [...prev, data.player_name!];
          foundRef.current = next;
          return next;
        });
        toast.success(data.player_name);
        if (challenge && foundRef.current.length === challenge.player_count) {
          endGame();
        }
      } else {
        setMisses((prev) => [name, ...prev].slice(0, 20));
      }
    } catch {
      toast.error("Error checking name");
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fanGamesApi.rosterLeaderboard();
      setLeaderboard(res.data);
    } catch {}
  };

  const handleTabChange = (t: "play" | "leaderboard") => {
    setTab(t);
    if (t === "leaderboard") loadLeaderboard();
  };

  const timerPct = (timeLeft / TIMER_SECONDS) * 100;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fan-games" className="btn-ghost text-sm px-2"><ChevronLeft size={16} /> Games</Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-slate-500"><Clock size={12} /> {today}</div>
      </div>

      <div className="page-header mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Users size={22} className="text-brand-300" />
          <h1 className="page-title">Name the Roster</h1>
          <span className="stat-pill bg-brand-500/20 text-brand-300 border border-brand-400/30 text-xs">Daily</span>
        </div>
        <p className="page-subtitle">Name as many players from today's featured team as you can in 2 minutes.</p>
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
          {!user && gameState === "idle" && (
            <div className="glass-card p-4 mb-4 flex items-center gap-3 border-brand-400/20">
              <AlertCircle size={16} className="text-brand-300 shrink-0" />
              <p className="text-sm text-slate-300">
                <Link href="/auth/login" className="text-brand-300 hover:underline font-medium">Sign in</Link>{" "}
                to save your score.
              </p>
            </div>
          )}

          {/* Team banner — hidden until game starts (or if already completed) */}
          {challenge && (gameState !== "idle" || completed) && (
            <div className="glass-card p-4 mb-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-lg font-black text-brand-300">
                {challenge.team_code}
              </div>
              <div>
                <div className="text-white font-bold text-lg">{challenge.team_name}</div>
                <div className="text-slate-500 text-sm">
                  {challenge.season != null ? `${String(challenge.season).match(/\d{4}/)?.[0] ?? challenge.season} ` : ""}
                  {challenge.team_name} • {challenge.player_count} players
                </div>
              </div>
              {gameState !== "idle" && (
                <div className="ml-auto text-right">
                  <div className="text-2xl font-black font-mono text-brand-300">{found.length}<span className="text-slate-500 text-sm font-normal">/{challenge.player_count}</span></div>
                  <div className="text-xs text-slate-500">found</div>
                </div>
              )}
            </div>
          )}

          {/* Idle state */}
          {gameState === "idle" && !completed && (
            <div className="glass-card p-8 text-center">
              <div className="text-5xl mb-4">⚾</div>
              <h2 className="text-xl font-bold text-white mb-2">Ready?</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                Type player names as fast as you can. Last names, first names, or full names all work.
                You have {Math.floor(TIMER_SECONDS / 60)} minutes.
              </p>
              <button onClick={startGame} className="btn-primary px-8">Start Timer</button>
            </div>
          )}

          {/* Previously completed */}
          {gameState === "idle" && completed && (
            <div className="glass-card p-6 text-center mb-4">
              <Check size={32} className="text-neon-green mx-auto mb-2" />
              <div className="text-white font-bold mb-1">Already played today!</div>
              <div className="text-slate-400 text-sm">You found {found.length}/{challenge?.player_count} players.</div>
              <div className="text-xs text-slate-500 mt-3">Come back tomorrow for a new team.</div>
            </div>
          )}

          {/* Playing state */}
          {gameState === "playing" && (
            <div className="space-y-4">
              {/* Timer */}
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-1000",
                      timeLeft <= 30 ? "bg-red-500" : "bg-gradient-to-r from-brand-400 to-neon-green")}
                    style={{ width: `${timerPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Time remaining</span>
                  <span className={cn("font-mono font-bold", timeLeft <= 30 ? "text-red-400" : "text-slate-300")}>
                    {mins}:{secs.toString().padStart(2, "0")}
                  </span>
                </div>
              </div>

              {/* Input */}
              <form onSubmit={handleGuess} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a player name..."
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 bg-surface-800/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/30"
                />
                <button type="submit" disabled={submitting || !input.trim()} className="btn-primary px-5">
                  {submitting ? "..." : "Got it"}
                </button>
              </form>

              {/* Give up */}
              <div className="text-center">
                <button onClick={() => endGame()} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  Give up &amp; reveal answers
                </button>
              </div>

              {/* Found list */}
              {found.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Found ({found.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {found.map((name) => (
                      <span key={name} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs font-medium">
                        <Check size={11} /> {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent misses */}
              {misses.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Not matched</div>
                  <div className="flex flex-wrap gap-1.5">
                    {misses.slice(0, 8).map((name, i) => (
                      <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-500 text-xs">
                        <X size={10} /> {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Done state */}
          {gameState === "done" && (
            <div className="space-y-4">
              <div className={cn("glass-card p-6 text-center",
                challenge && found.length === challenge.player_count
                  ? "border-neon-green/30"
                  : "border-white/10")}>
                <div className="text-4xl mb-2">{challenge && found.length === challenge.player_count ? "🏆" : "⚾"}</div>
                <div className="text-2xl font-black text-white mb-1">
                  {found.length}<span className="text-slate-500 font-normal text-lg">/{challenge?.player_count}</span>
                </div>
                <div className="text-slate-400 text-sm mb-1">
                  {challenge && found.length === challenge.player_count ? "Perfect roster!" : `players found`}
                </div>
                <div className="text-xs text-slate-500">Come back tomorrow for a new team.</div>
              </div>

              {/* Found */}
              {found.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">You found</div>
                  <div className="flex flex-wrap gap-1.5">
                    {found.map((name) => (
                      <span key={name} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs font-medium">
                        <Check size={11} /> {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed players */}
              {revealedRoster.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">
                    {found.length < revealedRoster.length ? "You missed" : "Full roster"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {revealedRoster
                      .filter((name) => !found.includes(name))
                      .map((name) => (
                        <span key={name} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs">
                          {name}
                        </span>
                      ))}
                  </div>
                </div>
              )}
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
                  <div className="text-right text-xs">
                    <div className="text-neon-green font-semibold">{entry.found}/{entry.total} players</div>
                    <div className="text-slate-500">{Math.round(entry.score)}pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
