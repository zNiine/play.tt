"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, ChevronLeft, Clock, Trophy, AlertCircle, ChevronDown, Check, X } from "lucide-react";
import Link from "next/link";
import { fanGamesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface ClueData {
  clue_index: number;
  clue_label: string;
  clue_value: string;
}

interface PlayerOption {
  id: number;
  full_name: string;
  team: string;
  position: string;
}

interface GuessResult {
  correct: boolean;
  clues_used: number;
  score: number;
  player_name?: string;
  player_team?: string;
  player_position?: string;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  clues_used: number;
  score: number;
}

const MAX_CLUES = 6;
const CLUE_LABELS = ["Region", "Position Group", "State", "Position & Bats", "Team", "Name Hint"];

export default function JourneyPage() {
  const { user } = useAuthStore();
  const [clues, setClues] = useState<ClueData[]>([]);
  const [cluesRevealed, setCluesRevealed] = useState(0);
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [guessResult, setGuessResult] = useState<GuessResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [revealedPlayer, setRevealedPlayer] = useState<{ name: string; team: string; position: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    fanGamesApi.journeyToday().then((res) => {
      const data = res.data;
      const cdata = data.challenge?.challenge_data || {};
      // Load initial clue (index 0)
      const initial = cdata.clues?.[0];
      if (initial) {
        setClues([{ clue_index: 0, clue_label: CLUE_LABELS[0], clue_value: initial }]);
        setCluesRevealed(1);
      }

      const result = data.result;
      if (result) {
        const rdata = result.result_data || {};
        setCluesRevealed(rdata.clues_used || 1);
        // Rebuild clues from challenge_data
        const allClues: ClueData[] = (cdata.clues || [])
          .slice(0, rdata.clues_used || 1)
          .map((v: string, i: number) => ({ clue_index: i, clue_label: CLUE_LABELS[i], clue_value: v }));
        setClues(allClues);
        if (result.completed) {
          setGameState(rdata.correct ? "won" : "lost");
          setRevealedPlayer({ name: rdata.player_name, team: rdata.player_team, position: rdata.player_position });
          setGuessResult({ correct: rdata.correct, clues_used: rdata.clues_used, score: result.score });
        }
      }
    }).catch(() => toast.error("Failed to load today's puzzle")).finally(() => setLoading(false));
  }, []);

  // Debounced player search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fanGamesApi.playerSearch(searchQuery);
        setSearchResults(res.data.slice(0, 8));
        setShowDropdown(true);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRevealClue = async () => {
    if (cluesRevealed >= MAX_CLUES || gameState !== "playing") return;
    try {
      const res = await fanGamesApi.journeyClue();
      const clue: ClueData = {
        clue_index: res.data.clue_index,
        clue_label: CLUE_LABELS[res.data.clue_index] || `Clue ${res.data.clue_index + 1}`,
        clue_value: res.data.clue_value,
      };
      setClues((prev) => [...prev, clue]);
      setCluesRevealed(res.data.clues_used);
    } catch {
      toast.error("Failed to reveal clue");
    }
  };

  const handleGuess = async (player: PlayerOption) => {
    setShowDropdown(false);
    setSearchQuery("");
    if (submitting || gameState !== "playing") return;
    setSubmitting(true);
    try {
      const res = await fanGamesApi.journeyGuess(player.id);
      const data: GuessResult = res.data;
      setGuessResult(data);
      if (data.correct) {
        setGameState("won");
        setRevealedPlayer({ name: data.player_name!, team: data.player_team!, position: data.player_position! });
        toast.success("Correct!");
      } else {
        // Wrong guess — reveal all clues and end
        const fullRes = await fanGamesApi.journeyResult().catch(() => null);
        if (fullRes) {
          const rdata = fullRes.data.result_data || {};
          setRevealedPlayer({ name: rdata.player_name, team: rdata.player_team, position: rdata.player_position });
          // Load all clues
          const cdata = fullRes.data.challenge?.challenge_data || {};
          const allClues: ClueData[] = (cdata.clues || []).map((v: string, i: number) => ({
            clue_index: i, clue_label: CLUE_LABELS[i], clue_value: v,
          }));
          setClues(allClues);
          setCluesRevealed(MAX_CLUES);
        }
        setGameState("lost");
        toast.error("Wrong — better luck tomorrow!");
      }
    } catch {
      toast.error("Error submitting guess");
    } finally {
      setSubmitting(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fanGamesApi.journeyLeaderboard();
      setLeaderboard(res.data);
    } catch {}
  };

  const handleTabChange = (t: "play" | "leaderboard") => {
    setTab(t);
    if (t === "leaderboard") loadLeaderboard();
  };

  const scoreForClue = (clueCount: number) => {
    const scores = [1000, 800, 600, 400, 200, 100];
    return scores[clueCount - 1] ?? 100;
  };

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
          <MapPin size={22} className="text-brand-300" />
          <h1 className="page-title">Franchise Journey</h1>
          <span className="stat-pill bg-brand-500/20 text-brand-300 border border-brand-400/30 text-xs">Daily</span>
        </div>
        <p className="page-subtitle">Identify the mystery ALPB player from progressive clues. Fewer clues = more points.</p>
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
          {!user && gameState === "playing" && (
            <div className="glass-card p-4 mb-4 flex items-center gap-3 border-brand-400/20">
              <AlertCircle size={16} className="text-brand-300 shrink-0" />
              <p className="text-sm text-slate-300">
                <Link href="/auth/login" className="text-brand-300 hover:underline font-medium">Sign in</Link>{" "}
                to save your score.
              </p>
            </div>
          )}

          {/* Score potential */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-slate-500">Potential score:</span>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span key={n} className={cn("stat-pill text-xs border",
                n === cluesRevealed && gameState === "playing"
                  ? "bg-brand-500/20 border-brand-400/40 text-brand-300 font-bold"
                  : n < cluesRevealed
                  ? "bg-white/5 border-white/10 text-slate-600 line-through"
                  : "bg-white/5 border-white/10 text-slate-500")}>
                {scoreForClue(n)}
              </span>
            ))}
          </div>

          {/* Clue cards */}
          <div className="space-y-2 mb-4">
            {clues.map((c) => (
              <div key={c.clue_index} className="glass-card p-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0">
                  {c.clue_index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">{c.clue_label}</div>
                  <div className="text-white font-semibold">{c.clue_value}</div>
                </div>
              </div>
            ))}

            {/* Locked clues */}
            {gameState === "playing" && cluesRevealed < MAX_CLUES && (
              Array.from({ length: MAX_CLUES - cluesRevealed }).map((_, i) => (
                <div key={`locked-${i}`} className="glass-card p-4 flex items-center gap-4 opacity-40">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                    {cluesRevealed + i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-600 uppercase tracking-widest mb-0.5">{CLUE_LABELS[cluesRevealed + i]}</div>
                    <div className="text-slate-700 font-semibold">••••••••</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Result banner */}
          {(gameState === "won" || gameState === "lost") && revealedPlayer && (
            <div className={cn("glass-card p-5 mb-4 text-center",
              gameState === "won" ? "border-neon-green/30" : "border-red-500/30")}>
              <div className="text-3xl mb-2">{gameState === "won" ? "🏆" : "😔"}</div>
              <div className="text-white font-bold text-lg mb-0.5">{revealedPlayer.name}</div>
              <div className="text-slate-400 text-sm mb-3">{revealedPlayer.team} • {revealedPlayer.position}</div>
              {guessResult && (
                <div className="flex items-center justify-center gap-4 text-xs">
                  <span className="text-slate-500">{guessResult.clues_used} clue{guessResult.clues_used !== 1 ? "s" : ""} used</span>
                  <span className={cn("font-bold", gameState === "won" ? "text-neon-green" : "text-red-400")}>
                    {gameState === "won" ? `+${guessResult.score} pts` : "0 pts"}
                  </span>
                </div>
              )}
              <div className="text-xs text-slate-500 mt-3">Come back tomorrow for a new player.</div>
            </div>
          )}

          {/* Actions */}
          {gameState === "playing" && (
            <div className="space-y-3">
              {/* Reveal next clue */}
              {cluesRevealed < MAX_CLUES && (
                <button
                  onClick={handleRevealClue}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all text-sm font-medium"
                >
                  <ChevronDown size={15} />
                  Reveal Clue {cluesRevealed + 1}
                  <span className="text-slate-500 text-xs font-normal">(-{scoreForClue(cluesRevealed) - scoreForClue(cluesRevealed + 1)} pts)</span>
                </button>
              )}

              {/* Player guess search */}
              <div className="relative" ref={dropdownRef}>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a player to guess..."
                  autoComplete="off"
                  className="w-full bg-surface-800/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/30"
                />
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-surface-900 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleGuess(p)}
                        disabled={submitting}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                          p.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                          {p.position}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{p.full_name}</div>
                          <div className="text-xs text-slate-500">{p.team}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                    <div className="text-neon-green font-semibold">{entry.score} pts</div>
                    <div className="text-slate-500">{entry.clues_used} clue{entry.clues_used !== 1 ? "s" : ""}</div>
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
