"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { slatesApi } from "@/lib/api";
import { formatDate, STATUS_COLORS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { TrendingUp, ChevronRight, Calendar } from "lucide-react";

interface Slate {
  id: number;
  slate_date: string;
  status: string;
  lock_time: string | null;
}

export default function SlatesPage() {
  const [slates, setSlates] = useState<Slate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    slatesApi.getAll()
      .then((r) => setSlates(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="page-header">
        <h1 className="page-title">Daily Fantasy Slates</h1>
        <p className="page-subtitle">Build a 6-player lineup — 5 batters + 1 pitcher — under $50,000</p>
      </div>

      {loading ? (
        <LoadingSpinner className="py-16" />
      ) : (
        <div className="space-y-3">
          {slates.map((slate) => (
            <Link
              key={slate.id}
              href={`/slate/${slate.id}`}
              className="glass-card-hover p-5 flex items-center gap-4 block"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center shrink-0">
                <TrendingUp size={20} className="text-brand-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">{formatDate(slate.slate_date)}</p>
                {slate.lock_time && (
                  <p className="text-slate-500 text-xs mt-0.5">
                    Locks {new Date(slate.lock_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <span className={cn("text-xs px-2.5 py-1 rounded-lg border font-medium", STATUS_COLORS[slate.status] || STATUS_COLORS.scheduled)}>
                {slate.status.toUpperCase()}
              </span>
              <ChevronRight size={16} className="text-slate-500" />
            </Link>
          ))}

          {!slates.length && (
            <div className="text-center py-16 text-slate-500">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p>No slates available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
