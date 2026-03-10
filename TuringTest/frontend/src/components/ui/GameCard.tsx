import { cn, formatTime, STATUS_COLORS } from "@/lib/utils";
import { CheckCircle2, Clock, Radio } from "lucide-react";

interface GameCardProps {
  game: {
    id: number;
    home_team?: { team_code: string; team_name: string } | null;
    away_team?: { team_code: string; team_name: string } | null;
    start_time: string;
    status: string;
  };
  confirmedCount?: number;
  className?: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  live: <span className="live-dot" />,
  final: <CheckCircle2 size={12} className="text-slate-400" />,
  scheduled: <Clock size={12} className="text-brand-400" />,
  lineups_confirmed: <CheckCircle2 size={12} className="text-neon-green" />,
  lineups_partial: <Clock size={12} className="text-yellow-400" />,
};

export default function GameCard({ game, confirmedCount, className }: GameCardProps) {
  const statusColor = STATUS_COLORS[game.status] || STATUS_COLORS.scheduled;

  return (
    <div className={cn("glass-card p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg border", statusColor)}>
          {STATUS_ICONS[game.status]}
          {game.status.replace("_", " ").toUpperCase()}
        </span>
        <span className="text-slate-500 text-xs">{formatTime(game.start_time)}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <p className="text-2xl font-black text-white" style={{ fontFamily: "var(--font-display)" }}>
            {game.away_team?.team_code ?? "—"}
          </p>
          <p className="text-slate-400 text-xs truncate">{game.away_team?.team_name ?? "Away"}</p>
        </div>

        <div className="text-center px-3">
          <p className="text-slate-500 text-sm font-bold">@</p>
        </div>

        <div className="text-center flex-1">
          <p className="text-2xl font-black text-white" style={{ fontFamily: "var(--font-display)" }}>
            {game.home_team?.team_code ?? "—"}
          </p>
          <p className="text-slate-400 text-xs truncate">{game.home_team?.team_name ?? "Home"}</p>
        </div>
      </div>

      {confirmedCount !== undefined && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", confirmedCount === 2 ? "bg-neon-green" : confirmedCount === 1 ? "bg-yellow-400" : "bg-slate-600")} />
          <span className="text-xs text-slate-400">
            {confirmedCount === 2 ? "Both lineups confirmed" : confirmedCount === 1 ? "1 lineup confirmed" : "Lineups pending"}
          </span>
        </div>
      )}
    </div>
  );
}
