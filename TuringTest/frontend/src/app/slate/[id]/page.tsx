"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { slatesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  cn, formatSalary, formatDate, formatPoints, POSITION_COLORS, STATUS_COLORS,
} from "@/lib/utils";
import PlayerCard from "@/components/ui/PlayerCard";
import SalaryCap from "@/components/ui/SalaryCap";
import LeaderboardTable from "@/components/ui/LeaderboardTable";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  TrendingUp, Save, Send, Trophy, Users, Filter, Search, X, Check,
} from "lucide-react";

interface SlatePlayer {
  id: number;
  slate_id: number;
  salary: number;
  eligible_positions: string[];
  active: boolean;
  player: {
    id: number;
    full_name: string;
    primary_position: string;
    team?: { team_code: string; team_name: string } | null;
  };
}

interface Pick {
  player_id: number;
  slot: number;
  position: string;
  salary: number;
  player: SlatePlayer["player"];
}

const SALARY_CAP = 50_000;
const SLOTS = [
  { slot: 1, label: "Batter 1", type: "batter" },
  { slot: 2, label: "Batter 2", type: "batter" },
  { slot: 3, label: "Batter 3", type: "batter" },
  { slot: 4, label: "Batter 4", type: "batter" },
  { slot: 5, label: "Batter 5", type: "batter" },
  { slot: 6, label: "Pitcher",  type: "pitcher" },
];

type Tab = "pool" | "lineup" | "leaderboard";

export default function SlatePage() {
  const { id } = useParams<{ id: string }>();
  const slateId = parseInt(id);
  const { user } = useAuthStore();

  const [slate, setSlate] = useState<{ id: number; slate_date: string; status: string; lock_time: string | null } | null>(null);
  const [players, setPlayers] = useState<SlatePlayer[]>([]);
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [activeTab, setActiveTab] = useState<Tab>("pool");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<unknown[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  const totalSalary = useMemo(
    () => Object.values(picks).reduce((sum, p) => sum + p.salary, 0),
    [picks]
  );

  useEffect(() => {
    async function load() {
      try {
        const [slateRes, playersRes] = await Promise.all([
          slatesApi.getById(slateId),
          slatesApi.getPlayers(slateId),
        ]);
        setSlate(slateRes.data);
        setPlayers(playersRes.data);

        // Load existing draft entry
        if (user) {
          const entryRes = await slatesApi.getEntry(slateId);
          if (entryRes.data?.picks) {
            const existingPicks: Record<number, Pick> = {};
            for (const pick of entryRes.data.picks) {
              const sp = playersRes.data.find((p: SlatePlayer) => p.player.id === pick.player.id);
              existingPicks[pick.slot] = {
                player_id: pick.player.id,
                slot: pick.slot,
                position: pick.position,
                salary: sp?.salary ?? 5000,
                player: pick.player,
              };
            }
            setPicks(existingPicks);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slateId, user]);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    setLbLoading(true);
    slatesApi.getLeaderboard(slateId)
      .then((r) => setLeaderboard(r.data.scores || []))
      .finally(() => setLbLoading(false));
  }, [activeTab, slateId]);

  const filteredPlayers = useMemo(() => {
    let list = players;
    if (posFilter !== "ALL") {
      if (posFilter === "P") list = list.filter((p) => p.player.primary_position === "P");
      else list = list.filter((p) => p.player.primary_position !== "P");
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.player.full_name.toLowerCase().includes(q) ||
          p.player.team?.team_code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [players, posFilter, search]);

  const pickedPlayerIds = useMemo(() => new Set(Object.values(picks).map((p) => p.player_id)), [picks]);

  const addPlayer = (sp: SlatePlayer) => {
    const isPitcher = sp.player.primary_position === "P";
    const targetSlot = isPitcher ? 6 : SLOTS.filter((s) => s.type === "batter").find((s) => !picks[s.slot])?.slot;
    if (!targetSlot) {
      toast.error(isPitcher ? "Pitcher slot already filled" : "All batter slots are filled");
      return;
    }
    if (totalSalary + sp.salary > SALARY_CAP) {
      toast.error("Adding this player would exceed the salary cap");
      return;
    }
    setPicks((prev) => ({
      ...prev,
      [targetSlot]: {
        player_id: sp.player.id, slot: targetSlot,
        position: sp.player.primary_position, salary: sp.salary, player: sp.player,
      },
    }));
  };

  const removePlayer = (slot: number) => {
    setPicks((prev) => { const next = { ...prev }; delete next[slot]; return next; });
  };

  const saveDraft = async () => {
    if (!user) { toast.error("Sign in to save your lineup"); return; }
    const picksArr = Object.values(picks);
    if (picksArr.length !== 6) { toast.error("Must have all 6 picks"); return; }
    try {
      await slatesApi.saveEntry(slateId, picksArr.map((p) => ({
        player_id: p.player_id, slot: p.slot, position: p.position,
      })));
      toast.success("Draft saved!");
    } catch {
      toast.error("Failed to save");
    }
  };

  const submitEntry = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    const picksArr = Object.values(picks);
    if (picksArr.length !== 6) { toast.error("Complete your lineup first"); return; }
    if (totalSalary > SALARY_CAP) { toast.error("Over salary cap"); return; }
    setSubmitting(true);
    try {
      await slatesApi.saveEntry(slateId, picksArr.map((p) => ({
        player_id: p.player_id, slot: p.slot, position: p.position,
      })));
      await slatesApi.submitEntry(slateId);
      toast.success("Entry submitted! Good luck! 🎯");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-24" />;
  if (!slate) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
      Slate not found. <Link href="/slate" className="text-brand-400">Back to slates</Link>
    </div>
  );

  const isLocked = slate.status === "locked" || slate.status === "live" || slate.status === "final";
  const filledCount = Object.keys(picks).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="page-title">
            {formatDate(slate.slate_date)} Contest
          </h1>
          <p className="page-subtitle">{formatSalary(SALARY_CAP)} salary cap · 5 batters + 1 pitcher</p>
        </div>
        <span className={cn(
          "text-xs px-3 py-1.5 rounded-xl border font-medium shrink-0",
          STATUS_COLORS[slate.status] || STATUS_COLORS.scheduled
        )}>
          {slate.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: player pool / lineup / leaderboard */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl border border-white/5 mb-4">
            {(["pool", "lineup", "leaderboard"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize",
                  activeTab === tab
                    ? "bg-surface-700 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {tab === "pool" && <><Users size={13} className="inline mr-1" />Player Pool</>}
                {tab === "lineup" && <><TrendingUp size={13} className="inline mr-1" />My Lineup</>}
                {tab === "leaderboard" && <><Trophy size={13} className="inline mr-1" />Leaderboard</>}
              </button>
            ))}
          </div>

          {activeTab === "pool" && (
            <>
              {/* Filters */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input-field pl-9 text-sm py-2"
                    placeholder="Search players..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  className="input-field w-auto pr-8 text-sm py-2 bg-surface-900"
                  value={posFilter}
                  onChange={(e) => setPosFilter(e.target.value)}
                >
                  <option value="ALL">All Positions</option>
                  <option value="P">Pitchers</option>
                  <option value="BAT">Batters</option>
                </select>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredPlayers.map((sp) => (
                  <PlayerCard
                    key={sp.id}
                    player={sp.player}
                    salary={sp.salary}
                    selected={pickedPlayerIds.has(sp.player.id)}
                    onAdd={() => addPlayer(sp)}
                    onRemove={() => {
                      const slot = Object.values(picks).find((p) => p.player_id === sp.player.id)?.slot;
                      if (slot) removePlayer(slot);
                    }}
                    disabled={isLocked}
                  />
                ))}
                {!filteredPlayers.length && (
                  <div className="text-center py-12 text-slate-500">No players match your filter</div>
                )}
              </div>
            </>
          )}

          {activeTab === "lineup" && (
            <div className="space-y-2">
              {SLOTS.map(({ slot, label, type }) => {
                const pick = picks[slot];
                return (
                  <div
                    key={slot}
                    className={cn(
                      "glass-card p-4 flex items-center gap-3",
                      !pick && "border-dashed border-white/10"
                    )}
                  >
                    <div className={cn(
                      "position-badge text-xs shrink-0",
                      type === "pitcher"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-brand-500/20 text-brand-300 border border-brand-500/30"
                    )}>
                      {type === "pitcher" ? "P" : `B${slot}`}
                    </div>
                    {pick ? (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm">{pick.player.full_name}</p>
                          <p className="text-slate-400 text-xs">{pick.player.team?.team_code || "—"} · {pick.position}</p>
                        </div>
                        <span className="salary-badge">{formatSalary(pick.salary)}</span>
                        {!isLocked && (
                          <button onClick={() => removePlayer(slot)} className="text-red-400 hover:text-red-300 p-1">
                            <X size={14} />
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-600 text-sm italic">{label} — empty</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "leaderboard" && (
            <LeaderboardTable
              entries={leaderboard as Parameters<typeof LeaderboardTable>[0]["entries"]}
              loading={lbLoading}
              highlightUserId={user?.id}
            />
          )}
        </div>

        {/* Right: lineup summary */}
        <div className="space-y-4">
          <SalaryCap used={totalSalary} />

          <div className="glass-card p-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Lineup Progress</p>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-neon-green transition-all duration-300"
                  style={{ width: `${(filledCount / 6) * 100}%` }}
                />
              </div>
              <span className="text-white font-mono text-sm">{filledCount}/6</span>
            </div>

            {/* Compact lineup list */}
            {SLOTS.map(({ slot, label }) => {
              const pick = picks[slot];
              return (
                <div key={slot} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-slate-500 text-xs">{label}</span>
                  {pick ? (
                    <span className="text-white text-xs font-medium truncate max-w-[120px]">{pick.player.full_name}</span>
                  ) : (
                    <span className="text-slate-700 text-xs">—</span>
                  )}
                </div>
              );
            })}

            {!isLocked && (
              <div className="mt-4 space-y-2">
                <button
                  onClick={saveDraft}
                  disabled={filledCount === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
                >
                  <Save size={14} /> Save Draft
                </button>
                <button
                  onClick={submitEntry}
                  disabled={filledCount < 6 || totalSalary > SALARY_CAP || submitting}
                  className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin" />
                  ) : (
                    <><Send size={14} /> Submit Entry</>
                  )}
                </button>
              </div>
            )}

            {isLocked && (
              <div className="mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-yellow-400 text-xs text-center font-medium">🔒 Contest is locked</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
