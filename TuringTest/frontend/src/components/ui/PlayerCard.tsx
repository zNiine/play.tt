"use client";

import { cn, formatSalary, POSITION_COLORS } from "@/lib/utils";
import { Plus, Minus, TrendingUp } from "lucide-react";

interface PlayerCardProps {
  player: {
    id: number;
    full_name: string;
    primary_position: string;
    team?: { team_code: string; team_name: string } | null;
  };
  salary: number;
  projectedPoints?: number;
  selected?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  stats?: Record<string, number>;
}

export default function PlayerCard({
  player, salary, projectedPoints, selected, onAdd, onRemove, disabled, stats,
}: PlayerCardProps) {
  const posColor = POSITION_COLORS[player.primary_position] || "bg-slate-500/20 text-slate-300";

  return (
    <div className={cn(
      "glass-card p-3 flex items-center gap-3 transition-all duration-200",
      selected && "border border-brand-400/40 bg-brand-500/5",
      !selected && !disabled && "hover:border-white/10 cursor-pointer",
      disabled && "opacity-50 cursor-not-allowed",
    )}>
      {/* Position badge */}
      <div className={cn("position-badge text-xs shrink-0", posColor)}>
        {player.primary_position}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{player.full_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {player.team && (
            <span className="text-slate-400 text-xs font-medium">{player.team.team_code}</span>
          )}
          {projectedPoints !== undefined && (
            <span className="flex items-center gap-0.5 text-brand-400 text-xs">
              <TrendingUp size={10} />
              {projectedPoints.toFixed(1)} proj
            </span>
          )}
        </div>
      </div>

      {/* Stats mini-display */}
      {stats && (
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 font-mono">
          {stats.H !== undefined && <span className="text-white">{stats.H}H</span>}
          {stats.HR !== undefined && <span className="text-neon-gold">{stats.HR}HR</span>}
          {stats.RBI !== undefined && <span>{stats.RBI}RBI</span>}
        </div>
      )}

      {/* Salary */}
      <div className="text-right shrink-0">
        <p className="salary-badge">{formatSalary(salary)}</p>
      </div>

      {/* Action */}
      {(onAdd || onRemove) && (
        <button
          onClick={selected ? onRemove : onAdd}
          disabled={disabled}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0",
            selected
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"
          )}
        >
          {selected ? <Minus size={14} /> : <Plus size={14} />}
        </button>
      )}
    </div>
  );
}
