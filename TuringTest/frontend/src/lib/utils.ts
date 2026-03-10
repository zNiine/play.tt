import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSalary(salary: number): string {
  return `$${salary.toLocaleString()}`;
}

export function formatPoints(points: number): string {
  return points.toFixed(1);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export const POSITION_COLORS: Record<string, string> = {
  P:  "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  C:  "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  "1B": "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "2B": "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
  "3B": "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  SS: "bg-green-500/20 text-green-300 border border-green-500/30",
  LF: "bg-pink-500/20 text-pink-300 border border-pink-500/30",
  CF: "bg-brand-500/20 text-brand-300 border border-brand-500/30",
  RF: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  DH: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
};

export const STATUS_COLORS: Record<string, string> = {
  open:       "text-neon-green bg-green-500/10 border-green-500/30",
  locked:     "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  live:       "text-red-400 bg-red-500/10 border-red-500/30",
  finalizing: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  final:      "text-slate-400 bg-slate-500/10 border-slate-500/30",
  scheduled:  "text-brand-300 bg-brand-500/10 border-brand-500/30",
};
