"use client";

import { useEffect, useState } from "react";
import { slatesApi, gamesApi } from "@/lib/api";
import { formatTime, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import GameCard from "@/components/ui/GameCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Calendar, ChevronDown, ChevronUp, CheckCircle2, Clock } from "lucide-react";

interface Game {
  id: number;
  home_team?: { team_code: string; team_name: string } | null;
  away_team?: { team_code: string; team_name: string } | null;
  start_time: string;
  status: string;
}

interface LineupPlayer {
  player: { full_name: string; primary_position: string };
  batting_order: number | null;
  position: string | null;
}

interface GameLineup {
  team: { team_code: string; team_name: string };
  confirmed: boolean;
  players: LineupPlayer[];
}

function GameLineupCard({ gameId }: { gameId: number }) {
  const [lineups, setLineups] = useState<GameLineup[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (lineups.length) { setExpanded(!expanded); return; }
    setLoading(true);
    setExpanded(true);
    try {
      const res = await gamesApi.getLineups(gameId);
      setLineups(res.data.lineups || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-brand-400 hover:text-brand-300 transition-colors"
      >
        <span>View Lineups</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <LoadingSpinner size="sm" className="py-4" />
          ) : !lineups.length ? (
            <p className="text-slate-500 text-sm text-center py-3">No lineups available yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lineups.map((lineup) => (
                <div key={lineup.team.team_code} className="bg-surface-900/60 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-white font-semibold text-sm">{lineup.team.team_name}</p>
                    {lineup.confirmed ? (
                      <CheckCircle2 size={12} className="text-neon-green" />
                    ) : (
                      <Clock size={12} className="text-slate-500" />
                    )}
                    <span className={cn(
                      "text-xs font-medium",
                      lineup.confirmed ? "text-neon-green" : "text-slate-500"
                    )}>
                      {lineup.confirmed ? "Confirmed" : "Pending"}
                    </span>
                  </div>

                  {lineup.players.length > 0 ? (
                    <div className="space-y-1">
                      {lineup.players
                        .sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99))
                        .map((lp, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className="text-slate-600 font-mono w-4 text-center">
                              {lp.batting_order || "—"}
                            </span>
                            <span className="text-white truncate">{lp.player.full_name}</span>
                            <span className="text-slate-400 shrink-0">{lp.position || lp.player.primary_position}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs">Lineup not yet posted</p>
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

export default function LineupsPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [lineupStatus, setLineupStatus] = useState<Record<number, { confirmed_count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));

  useEffect(() => {
    async function load() {
      try {
        // Load today's slate to get games
        const slateRes = await slatesApi.getToday();
        const slateData = slateRes.data;
        if (slateData.games) {
          setGames(slateData.games);
          // Load lineup status for each game
          const statusMap: Record<number, { confirmed_count: number }> = {};
          await Promise.all(slateData.games.map(async (g: Game) => {
            try {
              const statusRes = await gamesApi.getLineupStatus(g.id);
              statusMap[g.id] = { confirmed_count: statusRes.data.lineups_confirmed };
            } catch {
              statusMap[g.id] = { confirmed_count: 0 };
            }
          }));
          setLineupStatus(statusMap);
        }
      } catch {
        // No slate today
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="page-header">
        <h1 className="page-title">Lineup Tracker</h1>
        <p className="page-subtitle">{today} — Check who&apos;s playing before you lock in</p>
      </div>

      {loading ? (
        <LoadingSpinner className="py-16" />
      ) : !games.length ? (
        <div className="text-center py-16 text-slate-500">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p>No games found for today</p>
          <p className="text-sm mt-1">Check back later or view upcoming slates</p>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => (
            <div key={game.id} className="glass-card overflow-hidden">
              <div className="p-4">
                <GameCard
                  game={game}
                  confirmedCount={lineupStatus[game.id]?.confirmed_count ?? 0}
                  className="border-0 shadow-none p-0"
                />
              </div>
              <div className="border-t border-white/5">
                <GameLineupCard gameId={game.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
