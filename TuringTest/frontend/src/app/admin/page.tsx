"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";
import { Settings, Plus, Database, Users, Calendar, Shield } from "lucide-react";

type Tab = "slates" | "games" | "teams" | "players" | "bts";

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("slates");
  const [loading, setLoading] = useState(false);
  const [slateForm, setSlateForm] = useState({ slate_date: "", lock_time: "", game_ids: "" });
  const [teamForm, setTeamForm] = useState({ team_code: "", team_name: "" });
  const [playerForm, setPlayerForm] = useState({
    full_name: "", primary_position: "CF", team_id: "", bats: "R", throws: "R",
  });
  const [gameForm, setGameForm] = useState({ home_team_id: "", away_team_id: "", start_time: "" });
  const [btsForm, setBtsForm] = useState({ date: "", lock_time: "" });

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "admin") { router.push("/"); return; }
  }, [user, router]);

  if (!user || user.role !== "admin") return <LoadingSpinner size="lg" className="py-24" />;

  const createSlate = async () => {
    setLoading(true);
    try {
      await api.post("/api/admin/slates", {
        slate_date: slateForm.slate_date,
        lock_time: slateForm.lock_time || null,
        game_ids: slateForm.game_ids ? slateForm.game_ids.split(",").map(Number) : [],
      });
      toast.success("Slate created!");
      setSlateForm({ slate_date: "", lock_time: "", game_ids: "" });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async () => {
    setLoading(true);
    try {
      await api.post("/api/admin/teams", teamForm);
      toast.success("Team created!");
      setTeamForm({ team_code: "", team_name: "" });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const createPlayer = async () => {
    setLoading(true);
    try {
      await api.post("/api/admin/players", {
        ...playerForm,
        team_id: playerForm.team_id ? parseInt(playerForm.team_id) : null,
      });
      toast.success("Player created!");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const createGame = async () => {
    setLoading(true);
    try {
      await api.post("/api/admin/games", {
        home_team_id: parseInt(gameForm.home_team_id),
        away_team_id: parseInt(gameForm.away_team_id),
        start_time: gameForm.start_time,
      });
      toast.success("Game created!");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const createBTSDay = async () => {
    setLoading(true);
    try {
      await api.post("/api/admin/bts-days", {
        date: btsForm.date,
        lock_time: btsForm.lock_time || null,
      });
      toast.success("BTS day created!");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "slates",  label: "Slates",  icon: <Calendar size={14} /> },
    { id: "games",   label: "Games",   icon: <Database size={14} /> },
    { id: "teams",   label: "Teams",   icon: <Shield size={14} /> },
    { id: "players", label: "Players", icon: <Users size={14} /> },
    { id: "bts",     label: "BTS Days",icon: <Settings size={14} /> },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Settings size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="page-title">Admin Panel</h1>
            <p className="page-subtitle">Manage slates, games, teams, and players</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl border border-white/5 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              tab === t.id ? "bg-surface-700 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Slates */}
      {tab === "slates" && (
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Create Slate</h3>
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Date</label>
              <input
                type="date"
                className="input-field"
                value={slateForm.slate_date}
                onChange={(e) => setSlateForm({ ...slateForm, slate_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Lock Time (optional)</label>
              <input
                type="datetime-local"
                className="input-field"
                value={slateForm.lock_time}
                onChange={(e) => setSlateForm({ ...slateForm, lock_time: e.target.value })}
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Game IDs (comma-separated)</label>
              <input
                type="text"
                className="input-field"
                placeholder="1,2,3"
                value={slateForm.game_ids}
                onChange={(e) => setSlateForm({ ...slateForm, game_ids: e.target.value })}
              />
            </div>
            <button onClick={createSlate} disabled={loading || !slateForm.slate_date} className="btn-primary">
              <Plus size={14} /> Create Slate
            </button>
          </div>
        </div>
      )}

      {/* Games */}
      {tab === "games" && (
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Create Game</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Home Team ID</label>
                <input type="number" className="input-field" value={gameForm.home_team_id}
                  onChange={(e) => setGameForm({ ...gameForm, home_team_id: e.target.value })} />
              </div>
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Away Team ID</label>
                <input type="number" className="input-field" value={gameForm.away_team_id}
                  onChange={(e) => setGameForm({ ...gameForm, away_team_id: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Start Time</label>
              <input type="datetime-local" className="input-field" value={gameForm.start_time}
                onChange={(e) => setGameForm({ ...gameForm, start_time: e.target.value })} />
            </div>
            <button onClick={createGame} disabled={loading} className="btn-primary">
              <Plus size={14} /> Create Game
            </button>
          </div>
        </div>
      )}

      {/* Teams */}
      {tab === "teams" && (
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Create Team</h3>
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Team Code</label>
              <input type="text" className="input-field" placeholder="HBG"
                value={teamForm.team_code}
                onChange={(e) => setTeamForm({ ...teamForm, team_code: e.target.value })} />
            </div>
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Team Name</label>
              <input type="text" className="input-field" placeholder="Harrisburg Senators"
                value={teamForm.team_name}
                onChange={(e) => setTeamForm({ ...teamForm, team_name: e.target.value })} />
            </div>
            <button onClick={createTeam} disabled={loading || !teamForm.team_code} className="btn-primary">
              <Plus size={14} /> Create Team
            </button>
          </div>
        </div>
      )}

      {/* Players */}
      {tab === "players" && (
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Create Player</h3>
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Full Name</label>
              <input type="text" className="input-field" placeholder="Marcus Johnson"
                value={playerForm.full_name}
                onChange={(e) => setPlayerForm({ ...playerForm, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Position</label>
                <select className="input-field bg-surface-900"
                  value={playerForm.primary_position}
                  onChange={(e) => setPlayerForm({ ...playerForm, primary_position: e.target.value })}>
                  {["P","C","1B","2B","3B","SS","LF","CF","RF","DH"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Team ID</label>
                <input type="number" className="input-field" placeholder="1"
                  value={playerForm.team_id}
                  onChange={(e) => setPlayerForm({ ...playerForm, team_id: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Bats</label>
                <select className="input-field bg-surface-900"
                  value={playerForm.bats}
                  onChange={(e) => setPlayerForm({ ...playerForm, bats: e.target.value })}>
                  <option value="R">Right</option>
                  <option value="L">Left</option>
                  <option value="S">Switch</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Throws</label>
                <select className="input-field bg-surface-900"
                  value={playerForm.throws}
                  onChange={(e) => setPlayerForm({ ...playerForm, throws: e.target.value })}>
                  <option value="R">Right</option>
                  <option value="L">Left</option>
                </select>
              </div>
            </div>
            <button onClick={createPlayer} disabled={loading || !playerForm.full_name} className="btn-primary">
              <Plus size={14} /> Create Player
            </button>
          </div>
        </div>
      )}

      {/* BTS Days */}
      {tab === "bts" && (
        <div className="glass-card p-6">
          <h3 className="section-title mb-4">Create BTS Day</h3>
          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Date</label>
              <input type="date" className="input-field"
                value={btsForm.date}
                onChange={(e) => setBtsForm({ ...btsForm, date: e.target.value })} />
            </div>
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider block mb-1">Lock Time (optional)</label>
              <input type="datetime-local" className="input-field"
                value={btsForm.lock_time}
                onChange={(e) => setBtsForm({ ...btsForm, lock_time: e.target.value })} />
            </div>
            <button onClick={createBTSDay} disabled={loading || !btsForm.date} className="btn-primary">
              <Plus size={14} /> Create BTS Day
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
