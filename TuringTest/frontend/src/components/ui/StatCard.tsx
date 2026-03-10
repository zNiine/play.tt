import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
  highlight?: boolean;
}

export default function StatCard({
  label, value, subvalue, icon: Icon, iconColor = "text-brand-400",
  trend, className, highlight,
}: StatCardProps) {
  return (
    <div className={cn(
      "glass-card p-5 flex items-start gap-4",
      highlight && "neon-border",
      className
    )}>
      {Icon && (
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          "bg-white/5"
        )}>
          <Icon size={20} className={iconColor} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className={cn(
          "text-2xl font-bold text-white",
          highlight && "gradient-text"
        )}>
          {value}
        </p>
        {subvalue && (
          <p className={cn(
            "text-xs mt-0.5",
            trend === "up" && "text-neon-green",
            trend === "down" && "text-red-400",
            !trend && "text-slate-500"
          )}>
            {trend === "up" && "↑ "}
            {trend === "down" && "↓ "}
            {subvalue}
          </p>
        )}
      </div>
    </div>
  );
}
