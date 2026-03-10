"use client";

import { cn, formatPoints } from "@/lib/utils";
import Link from "next/link";
import { Crown, Medal } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string | null;
  total_points: number;
  total_salary?: number;
  entries_count?: number;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading?: boolean;
  highlightUserId?: string;
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="rank-badge rank-1 w-7 h-7">
      <Crown size={14} />
    </div>
  );
  if (rank === 2) return <div className="rank-badge rank-2 w-7 h-7 text-xs">{rank}</div>;
  if (rank === 3) return <div className="rank-badge rank-3 w-7 h-7 text-xs">{rank}</div>;
  return (
    <span className="text-slate-500 text-sm font-mono w-7 text-center">
      {rank}
    </span>
  );
}

export default function LeaderboardTable({
  entries, loading, highlightUserId,
}: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Medal size={32} className="mx-auto mb-3 opacity-30" />
        <p>No entries yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {entries.map((entry) => {
        const isHighlighted = entry.user_id === highlightUserId;
        return (
          <div
            key={`${entry.user_id}-${entry.rank}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              isHighlighted
                ? "bg-brand-500/10 border border-brand-400/30"
                : "bg-white/3 hover:bg-white/5 border border-transparent"
            )}
          >
            <RankDisplay rank={entry.rank} />

            <div className="flex-1 min-w-0">
              <Link
                href={`/profile/${entry.user_id}`}
                className="text-white font-medium text-sm hover:text-brand-300 transition-colors truncate block"
              >
                {entry.display_name || "Unknown"}
                {isHighlighted && (
                  <span className="ml-2 text-xs text-brand-400 font-normal">(You)</span>
                )}
              </Link>
              {entry.entries_count !== undefined && (
                <p className="text-slate-500 text-xs">{entry.entries_count} entries</p>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className={cn(
                "font-bold font-mono text-sm",
                entry.rank <= 3 ? "text-neon-gold" : "text-white"
              )}>
                {formatPoints(entry.total_points)} pts
              </p>
              {entry.total_salary !== undefined && (
                <p className="text-slate-500 text-xs font-mono">
                  ${entry.total_salary.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
