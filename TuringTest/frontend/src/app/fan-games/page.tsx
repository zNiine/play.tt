"use client";

import Link from "next/link";
import { Grid3X3, User, Target, ArrowUpDown, Clock, Zap, Infinity, Layers, Users } from "lucide-react";

const games = [
  {
    href: "/fan-games/grid",
    icon: Grid3X3,
    title: "Immaculate Grid",
    badge: "Daily",
    badgeColor: "bg-brand-500/20 text-brand-300 border-brand-400/30",
    description:
      "Fill a 3×3 grid by naming ALPB players who match both the row and column category. One shared puzzle every day — how rare can you go?",
    stats: ["9 cells", "Limited misses", "Rarity scoring"],
    gradient: "from-brand-500/20 to-brand-700/10",
    glowColor: "rgba(0,212,255,0.15)",
  },
  {
    href: "/fan-games/guess",
    icon: User,
    title: "Guess the Player",
    badge: "Daily",
    badgeColor: "bg-brand-500/20 text-brand-300 border-brand-400/30",
    description:
      "A mystery ALPB player is revealed clue by clue. Each wrong guess shows you how close you are. Can you crack it in fewer guesses?",
    stats: ["8 guesses", "Wordle-style hints", "Speed scoring"],
    gradient: "from-neon-green/10 to-transparent",
    glowColor: "rgba(57,255,20,0.12)",
  },
  {
    href: "/fan-games/target",
    icon: Target,
    title: "Target Line",
    badge: "Daily",
    badgeColor: "bg-brand-500/20 text-brand-300 border-brand-400/30",
    description:
      "A target stat line drops. You have 90 seconds to build a roster of ALPB players whose combined stats get as close as possible.",
    stats: ["90 seconds", "Up to 5 players", "Closeness score"],
    gradient: "from-orange-500/15 to-transparent",
    glowColor: "rgba(249,115,22,0.12)",
  },
  {
    href: "/fan-games/higher-lower",
    icon: ArrowUpDown,
    title: "Higher or Lower",
    badge: "Unlimited",
    badgeColor: "bg-neon-green/10 text-neon-green border-neon-green/30",
    description:
      "Two ALPB players, one stat. Is the second player's number higher or lower? Keep your streak alive — 15 seconds per round.",
    stats: ["15s per round", "Endless play", "All-time streaks"],
    gradient: "from-purple-500/15 to-transparent",
    glowColor: "rgba(168,85,247,0.12)",
  },
  {
    href: "/fan-games/connections",
    icon: Layers,
    title: "Connections",
    badge: "Daily",
    badgeColor: "bg-brand-500/20 text-brand-300 border-brand-400/30",
    description:
      "16 ALPB player names, 4 hidden groups of 4. Find the connection before you run out of mistakes. Four color-coded difficulty tiers.",
    stats: ["16 players", "4 groups", "4 mistakes allowed"],
    gradient: "from-yellow-500/10 to-transparent",
    glowColor: "rgba(234,179,8,0.12)",
  },
  {
    href: "/fan-games/roster",
    icon: Users,
    title: "Name the Roster",
    badge: "Daily",
    badgeColor: "bg-brand-500/20 text-brand-300 border-brand-400/30",
    description:
      "Today's featured ALPB team is on the clock. How many players from their roster can you name in 2 minutes? Type fast.",
    stats: ["2 minutes", "Fuzzy matching", "Full roster reveal"],
    gradient: "from-teal-500/10 to-transparent",
    glowColor: "rgba(20,184,166,0.12)",
  },
];

export default function FanGamesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="page-header text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-400/20 text-brand-300 text-xs font-semibold tracking-widest uppercase mb-4">
          <Zap size={12} /> Fan Games
        </div>
        <h1 className="page-title text-4xl mb-3">
          Test Your{" "}
          <span className="gradient-text">Baseball IQ</span>
        </h1>
        <p className="text-slate-400 text-base max-w-xl mx-auto">
          ALPB-powered knowledge games. Daily puzzles reset every morning at 4&nbsp;AM.
          Compete with other fans, climb the leaderboards, and learn more about the league.
        </p>
      </div>

      {/* Game grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {games.map(({ href, icon: Icon, title, badge, badgeColor, description, stats, gradient, glowColor }) => (
          <Link
            key={href}
            href={href}
            className="group glass-card-hover p-6 flex flex-col gap-5 relative overflow-hidden"
            style={{ "--glow-color": glowColor } as React.CSSProperties}
          >
            {/* Background glow */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300`}
            />

            <div className="relative">
              {/* Top row */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-brand-400/30 transition-colors">
                  <Icon size={22} className="text-brand-300" />
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}
                >
                  {badge === "Daily" ? <Clock size={10} /> : <Infinity size={10} />}
                  {badge}
                </span>
              </div>

              {/* Title + description */}
              <h2 className="text-xl font-bold text-white mb-2 group-hover:text-brand-200 transition-colors"
                style={{ fontFamily: "var(--font-display)" }}>
                {title}
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{description}</p>

              {/* Stat pills */}
              <div className="flex flex-wrap gap-2">
                {stats.map((s) => (
                  <span key={s} className="stat-pill bg-white/5 border border-white/10 text-slate-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Play button hint */}
            <div className="relative mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {badge === "Daily" ? "New puzzle daily at 4 AM" : "Play anytime"}
              </span>
              <span className="text-brand-300 text-sm font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Play now →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-10 text-center">
        <p className="text-slate-500 text-xs">
          All data sourced from ALPB player and team records. Daily games reset at 4:00&nbsp;AM ET.
        </p>
      </div>
    </div>
  );
}
