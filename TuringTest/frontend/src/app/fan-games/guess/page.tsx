"use client";

import { useState, useEffect, useRef } from "react";
import { User, ChevronLeft, Clock, Trophy, Check, X, Minus, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import { fanGamesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type MatchResult = "exact" | "close" | "wrong" | "high" | "low" | "unknown";

interface GuessedPlayer {
  id: number;
  full_name: string;
  team_code: string | null;
  team_name: string | null;
  position: string | null;
  division: string | null;
  bats: string | null;
  throws: string | null;
  jersey: string | null;
  height: string | null;
  weight: string | null;
}

interface FeedbackRow {
  guessed_player: GuessedPlayer;
  feedback: {
    team: MatchResult;
    position: MatchResult;
    division: MatchResult;
    bats: MatchResult;
    throws: MatchResult;
    jersey: MatchResult;
    height: MatchResult;
    weight: MatchResult;
  };
  correct: boolean;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  solved: boolean;
  guesses_used: number;
  score: number;
}

interface PlayerOption {
  id: number;
  full_name: string;
  position: string;
  team: string;
  team_name: string;
}

function MatchCell({ value, match, className }: { value: string | null; match: MatchResult; className?: string }) {
  const base = "flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 px-1 text-[11px] border min-h-[44px]";

  if (match === "exact") {
    return (
      <div className={cn(base, "bg-neon-green/20 border-neon-green/40 text-neon-green", className)}>
        <Check size={10} />
        <span className="leading-tight text-center font-medium">{value ?? "—"}</span>
      </div>
    );
  }
  if (match === "close") {
    return (
      <div className={cn(base, "bg-yellow-500/20 border-yellow-500/40 text-yellow-300", className)}>
        <Minus size={10} />
        <span className="leading-tight text-center font-medium">{value ?? "—"}</span>
      </div>
    );
  }
  if (match === "high") {
    return (
      <div className={cn(base, "bg-red-500/15 border-red-500/30 text-red-400", className)}>
        <ChevronDown size={10} />
        <span className="leading-tight text-center font-medium">{value ?? "—"}</span>
      </div>
    );
  }
  if (match === "low") {
    return (
      <div className={cn(base, "bg-orange-500/15 border-orange-500/30 text-orange-300", className)}>
        <ChevronUp size={10} />
        <span className="leading-tight text-center font-medium">{value ?? "—"}</span>
      </div>
    );
  }
  // wrong or unknown
  return (
    <div className={cn(base, "bg-white/5 border-white/10 text-slate-500", className)}>
      {match === "wrong" ? <X size={10} /> : <Minus size={10} />}
      <span className="leading-tight text-center font-medium">{value ?? "—"}</span>
    </div>
  );
}

const COLS: { key: keyof FeedbackRow["feedback"]; label: string; playerKey: keyof GuessedPlayer }[] = [
  { key: "team", label: "Team", playerKey: "team_code" },
  { key: "division", label: "Div", playerKey: "division" },
  { key: "position", label: "Pos", playerKey: "position" },
  { key: "bats", label: "Bats", playerKey: "bats" },
  { key: "throws", label: "Throws", playerKey: "throws" },
  { key: "jersey", label: "Jersey", playerKey: "jersey" },
  { key: "height", label: "Height", playerKey: "height" },
  { key: "weight", label: "Weight", playerKey: "weight" },
];

export default function GuessThePlayerPage() {
  const { user } = useAuthStore();
  const [maxGuesses, setMaxGuesses] = useState(8);
  const [guesses, setGuesses] = useState<FeedbackRow[]>([]);
  const [solved, setSolved] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [answer, setAnswer] = useState<{ player_name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    fanGamesApi.guessToday().then((res) => {
      const data = res.data;
      setMaxGuesses(data.challenge.max_guesses);
      const result = data.result;
      if (result) {
        const rdata = result.result_data;
        setGuesses(rdata.guesses || []);
        setSolved(rdata.solved || false);
        setCompleted(result.completed);
        if (result.completed) {
          fanGamesApi.guessResult().then((r) => {
            if (r.data.answer) setAnswer(r.data.answer);
          }).catch(() => {});
        }
      }
    }).catch(() => toast.error("Failed to load today's puzzle")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fanGamesApi.playerSearch(searchQuery);
        setSearchResults(res.data);
      } finally { setSearching(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleGuess = async (player: PlayerOption) => {
    if (!user) { toast.error("Sign in to play"); return; }
    if (completed || submitting) return;
    setSubmitting(true);
    setSearchQuery("");
    setSearchResults([]);

    try {
      const res = await fanGamesApi.guessSubmit(player.id);
      const data = res.data;
      setGuesses((prev) => [...prev, data.feedback]);
      setSolved(data.solved);
      setCompleted(data.completed);
      if (data.completed) {
        setAnswer(data.answer);
        toast.success(data.solved ? `You got it! ${data.answer?.player_name}` : `Answer: ${data.answer?.player_name}`, { duration: 5000 });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; msg?: string } } })?.response?.data?.error
        || (err as { response?: { data?: { msg?: string } } })?.response?.data?.msg
        || "Error submitting guess";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fanGamesApi.guessLeaderboard();
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

  const guessesLeft = maxGuesses - guesses.length;

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
          <User size={22} className="text-brand-300" />
          <h1 className="page-title">Guess the Player</h1>
          <span className="stat-pill bg-brand-500/20 text-brand-300 border border-brand-400/30 text-xs">Daily</span>
        </div>
        <p className="page-subtitle">Search for an ALPB player and see how their attributes compare to the mystery player.</p>
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
          {/* Status bar */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="text-slate-400">
              {guessesLeft > 0 ? `${guessesLeft} guess${guessesLeft !== 1 ? "es" : ""} remaining` : "No guesses left"}
            </span>
            {solved && <span className="stat-pill bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs">Solved!</span>}
            {completed && !solved && <span className="stat-pill bg-red-500/10 border border-red-500/30 text-red-400 text-xs">Game Over</span>}
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

          {/* Guess table */}
          {guesses.length > 0 && (
            <div className="glass-card mb-4 overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-slate-500 font-medium px-3 py-2 w-32">Player</th>
                    {COLS.map((c) => (
                      <th key={c.key} className="text-center text-slate-500 font-medium px-1 py-2">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guesses.map((g, i) => (
                    <tr key={i} className={cn("border-b border-white/5 last:border-0", g.correct && "bg-neon-green/5")}>
                      <td className="px-3 py-1.5">
                        <span className="text-white font-medium text-xs leading-tight block truncate max-w-[120px]">
                          {g.guessed_player.full_name}
                        </span>
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} className="px-1 py-1.5">
                          <MatchCell
                            value={g.guessed_player[c.playerKey] as string | null}
                            match={g.feedback[c.key]}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-t border-white/5 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Check size={10} className="text-neon-green" /> Exact match</span>
                <span className="flex items-center gap-1"><Minus size={10} className="text-yellow-400" /> Same group</span>
                <span className="flex items-center gap-1"><X size={10} /> No match</span>
                <span className="flex items-center gap-1"><ChevronDown size={10} className="text-red-400" /> Target is lower</span>
                <span className="flex items-center gap-1"><ChevronUp size={10} className="text-orange-300" /> Target is higher</span>
              </div>
            </div>
          )}

          {/* Answer reveal */}
          {completed && answer && (
            <div className={cn("glass-card p-4 mb-4 border", solved ? "border-neon-green/30" : "border-red-500/20")}>
              <div className="text-xs text-slate-500 mb-1">{solved ? "You got it!" : "The answer was:"}</div>
              <div className="text-lg font-bold text-white">{answer.player_name}</div>
            </div>
          )}

          {/* Input */}
          {!completed && (
            <div className="glass-card p-4">
              <label className="text-xs text-slate-500 mb-2 block">Search for a player to guess</label>
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Player name..."
                className="input-field mb-3"
                disabled={submitting}
                autoFocus
              />
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {searching && <div className="text-center py-3 text-slate-500 text-sm">Searching...</div>}
                {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                  <div className="text-center py-3 text-slate-500 text-sm">No players found</div>
                )}
                {searchResults.map((p) => {
                  const alreadyGuessed = guesses.some((g) => g.guessed_player.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => !alreadyGuessed && handleGuess(p)}
                      disabled={alreadyGuessed || submitting}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                        alreadyGuessed ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5"
                      )}
                    >
                      <div className={cn("position-badge text-xs",
                        p.position === "P" ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                        {p.position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">{p.full_name}</div>
                        <div className="text-xs text-slate-500">{p.team_name}</div>
                      </div>
                      {alreadyGuessed && <span className="text-xs text-slate-600">guessed</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {completed && (
            <div className="text-center text-xs text-slate-500 mt-4">
              Come back tomorrow for a new mystery player!
            </div>
          )}
        </>
      )}

      {tab === "leaderboard" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Today&apos;s Leaderboard</h3>
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
                    {entry.solved
                      ? <span className="text-neon-green font-bold">Solved in {entry.guesses_used}</span>
                      : <span className="text-red-400">Failed</span>}
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
