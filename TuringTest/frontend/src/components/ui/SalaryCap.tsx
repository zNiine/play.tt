import { cn, formatSalary } from "@/lib/utils";

interface SalaryCapProps {
  used: number;
  cap?: number;
}

const CAP = 50_000;

export default function SalaryCap({ used, cap = CAP }: SalaryCapProps) {
  const pct = Math.min((used / cap) * 100, 100);
  const remaining = cap - used;
  const isWarning = pct > 85;
  const isOver = used > cap;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Salary Cap</span>
        <span className={cn(
          "font-mono font-bold text-sm",
          isOver ? "text-red-400" : isWarning ? "text-yellow-400" : "text-neon-green"
        )}>
          {formatSalary(remaining)} left
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isOver ? "bg-red-500" : isWarning ? "bg-yellow-400" : "bg-gradient-to-r from-brand-400 to-neon-green"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
        <span>{formatSalary(used)} used</span>
        <span>{formatSalary(cap)} cap</span>
      </div>

      {isOver && (
        <p className="text-red-400 text-xs mt-2 font-medium">⚠ Over salary cap by {formatSalary(used - cap)}</p>
      )}
    </div>
  );
}
