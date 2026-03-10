"use client";

import { useState, useEffect } from "react";
import { Layers, ChevronLeft, Clock, Trophy, AlertCircle, Check } from "lucide-react";
import Link from "next/link";
import { fanGamesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface GroupMeta {
  id: string;
  category: string;
  category_hint: string;
  difficulty: number;
  color: string;
}

interface Item {
  name: string;
  group_id: string;
}

interface SolvedGroup {
  id: string;
  category: string;
  color: string;
  difficulty: number;
  names: string[];
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  solved: number;
  mistakes: number;
  score: number;
}

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-500/20 border-yellow-400/40 text-yellow-300",
  green:  "bg-neon-green/20 border-neon-green/40 text-neon-green",
  blue:   "bg-brand-500/20 border-brand-400/40 text-brand-300",
  purple: "bg-purple-500/20 border-purple-400/40 text-purple-300",
};

const SELECTED_RING = "ring-2 ring-white/60 bg-white/10";

export default function ConnectionsPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<GroupMeta[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [solvedGroups, setSolvedGroups] = useState<SolvedGroup[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [maxMistakes, setMaxMistakes] = useState(4);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [revealedAnswers, setRevealedAnswers] = useState<SolvedGroup[]>([]);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    fanGamesApi.connectionsToday().then((res) => {
      const data = res.data;
      const cdata = data.challenge?.challenge_data || {};
      setItems(cdata.items || []);
      setGroups(cdata.groups || []);
      setMaxMistakes(cdata.max_mistakes || 4);

      const result = data.result;
      if (result) {
        const rdata = result.result_data;
        const solved: string[] = rdata.solved_groups || [];
        setMistakes(rdata.mistakes || 0);
        setCompleted(result.completed);

        if (result.completed) {
          // When game is over (win or lose), fetch and show all answers + connections
          fanGamesApi.connectionsAnswers().then((r) => {
            const groups = r.data.groups || [];
            setRevealedAnswers(groups);
            setSolvedGroups(groups.filter((g: SolvedGroup) => solved.includes(g.id)));
          }).catch(() => {});
        }
      }
    }).catch(() => toast.error("Failed to load today's puzzle")).finally(() => setLoading(false));
  }, []);

  const toggleSelect = (name: string) => {
    if (completed) return;
    if (selected.includes(name)) {
      setSelected((prev) => prev.filter((n) => n !== name));
    } else if (selected.length < 4) {
      setSelected((prev) => [...prev, name]);
    }
  };

  const handleSubmit = async () => {
    if (selected.length !== 4 || submitting || !user) return;
    if (!user) { toast.error("Sign in to play"); return; }
    setSubmitting(true);

    // Try each group ID to see which matches — try most obvious first
    // Actually we need to figure out which group_id to try
    // Find the group_id that contains all selected names
    // We don't know group IDs client-side, so just pick the first one to try
    // The server validates against all groups
    // We need to pick a group_id — let's try each group
    let found = false;
    for (const g of groups) {
      if (solvedGroups.some((sg) => sg.id === g.id)) continue;
      try {
        const res = await fanGamesApi.connectionsGuess(g.id, selected);
        const data = res.data;
        if (data.correct) {
          const newSolvedGroup: SolvedGroup = {
            id: g.id,
            category: g.category,
            color: g.color,
            difficulty: g.difficulty,
            names: data.reveal || selected,
          };
          setSolvedGroups((prev) => [...prev, newSolvedGroup]);
          // Remove solved items from board
          setItems((prev) => prev.filter((item) => !data.reveal?.includes(item.name)));
          setSelected([]);
          toast.success(`${g.category}!`);

          if (data.completed) {
            setCompleted(true);
            fanGamesApi.connectionsAnswers().then((r) => {
              setRevealedAnswers(r.data.groups || []);
            }).catch(() => {});
          }
          found = true;
          break;
        }
      } catch {}
    }

    if (!found) {
      // All groups checked and none matched — it's a wrong answer
      try {
        // Submit to a non-matching group to register the mistake
        const firstUnsolved = groups.find((g) => !solvedGroups.some((sg) => sg.id === g.id));
        if (firstUnsolved) {
          const res = await fanGamesApi.connectionsGuess(firstUnsolved.id, selected);
          const data = res.data;
          setMistakes(data.mistakes);
          if (data.completed) setCompleted(true);
        }
      } catch {}
      toast.error("Not quite — try a different grouping");
      setSelected([]);
    }
    setSubmitting(false);
  };

  const handleGiveUp = async () => {
    try {
      const res = await fanGamesApi.connectionsGiveUp();
      setCompleted(true);
      setRevealedAnswers(res.data.groups || []);
      setItems([]);
    } catch {
      toast.error("Failed to reveal answers");
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fanGamesApi.connectionsLeaderboard();
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

  const mistakesLeft = maxMistakes - mistakes;
  const difficultyOrder = [1, 2, 3, 4];

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
          <Layers size={22} className="text-brand-300" />
          <h1 className="page-title">Connections</h1>
          <span className="stat-pill bg-brand-500/20 text-brand-300 border border-brand-400/30 text-xs">Daily</span>
        </div>
        <p className="page-subtitle">Find four groups of four ALPB players that share a hidden connection.</p>
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
          {/* Status */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Mistakes:</span>
              <div className="flex gap-1">
                {Array.from({ length: maxMistakes }).map((_, i) => (
                  <div key={i} className={cn("w-3 h-3 rounded-full",
                    i < mistakes ? "bg-red-500" : "bg-white/20")} />
                ))}
              </div>
            </div>
            {completed && (
              <span className={cn("stat-pill text-xs",
                solvedGroups.length === 4
                  ? "bg-neon-green/10 border border-neon-green/30 text-neon-green"
                  : "bg-red-500/10 border border-red-500/30 text-red-400")}>
                {solvedGroups.length === 4 ? "Solved!" : "Game Over"}
              </span>
            )}
          </div>

          {!user && (
            <div className="glass-card p-4 mb-4 flex items-center gap-3 border-brand-400/20">
              <AlertCircle size={16} className="text-brand-300 shrink-0" />
              <p className="text-sm text-slate-300">
                <Link href="/auth/login" className="text-brand-300 hover:underline font-medium">Sign in</Link>{" "}
                to save your progress.
              </p>
            </div>
          )}

          {/* Difficulty legend */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {difficultyOrder.map((d) => {
              const g = groups.find((gg) => gg.difficulty === d);
              if (!g) return null;
              const colorClass = COLOR_MAP[g.color] || "bg-white/10 text-white";
              return (
                <span key={d} className={cn("stat-pill border text-xs", colorClass)}>
                  {d === 1 ? "Easier" : d === 2 ? "Medium" : d === 3 ? "Tricky" : "Hardest"}
                </span>
              );
            })}
          </div>

          {/* Solved groups */}
          {solvedGroups.map((g) => {
            const colorClass = COLOR_MAP[g.color] || "bg-white/10 border-white/20 text-white";
            return (
              <div key={g.id} className={cn("rounded-xl border p-3 mb-2 text-center", colorClass)}>
                <div className="font-bold text-sm mb-1">{g.category}</div>
                <div className="text-xs opacity-80">{g.names.join(", ")}</div>
              </div>
            );
          })}

          {/* Game board */}
          {items.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {items.map((item) => {
                const isSelected = selected.includes(item.name);
                return (
                  <button
                    key={item.name}
                    onClick={() => toggleSelect(item.name)}
                    disabled={completed}
                    className={cn(
                      "h-16 rounded-xl border text-xs font-semibold transition-all duration-150 px-1 text-center leading-tight",
                      isSelected
                        ? "bg-white/15 border-white/50 text-white ring-2 ring-white/40"
                        : "bg-surface-800/60 border-white/10 text-slate-300 hover:bg-white/8 hover:border-white/25 hover:text-white"
                    )}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* After game: show all answers and connections */}
          {completed && revealedAnswers.length > 0 && (
            <div className="space-y-2 mb-4">
              <h3 className="text-sm font-semibold text-white mb-2">Answers &amp; connections</h3>
              {revealedAnswers.map((g) => {
                const colorClass = COLOR_MAP[g.color] || "bg-white/10 border-white/20 text-white";
                const wasSolved = solvedGroups.some((sg) => sg.id === g.id);
                return (
                  <div key={g.id} className={cn("rounded-xl border p-3 text-center", wasSolved ? colorClass : "opacity-80 " + colorClass)}>
                    <div className="font-bold text-sm mb-1">{g.category}</div>
                    <div className="text-xs opacity-90">{g.names.join(", ")}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          {!completed && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected([])}
                  disabled={selected.length === 0}
                  className="btn-ghost flex-1"
                >
                  Clear
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={selected.length !== 4 || submitting || !user}
                  className={cn("btn-primary flex-1", selected.length !== 4 && "opacity-50 cursor-not-allowed")}
                >
                  {submitting ? "Checking..." : `Submit (${selected.length}/4)`}
                </button>
              </div>
              <div className="text-center">
                <button
                  onClick={handleGiveUp}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Give up &amp; reveal answers
                </button>
              </div>
            </div>
          )}

          {completed && (
            <div className="text-center text-xs text-slate-500 mt-2">
              Come back tomorrow for a new puzzle!
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
                    <div className="text-neon-green font-semibold">{entry.solved}/4 groups</div>
                    <div className="text-slate-500">{entry.mistakes} mistakes</div>
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
