import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Attach JWT from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${refreshToken}` } }
          );
          localStorage.setItem("access_token", data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        }
      } catch {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; display_name: string }) =>
    api.post("/api/auth/register", data),
  login: (data: { email: string; password: string }) => api.post("/api/auth/login", data),
  logout: () => api.post("/api/auth/logout"),
  me: () => api.get("/api/auth/me"),
  forgotPassword: (email: string) => api.post("/api/auth/forgot-password", { email }),
  resetPassword: (token: string, new_password: string) =>
    api.post("/api/auth/reset-password", { token, new_password }),
};

// ── Slates ────────────────────────────────────────────────────────────────────
export const slatesApi = {
  getAll: () => api.get("/api/slates/"),
  getToday: () => api.get("/api/slates/today"),
  getById: (id: number) => api.get(`/api/slates/${id}`),
  getPlayers: (id: number, position?: string) =>
    api.get(`/api/slates/${id}/players`, { params: { position } }),
  getEntry: (id: number) => api.get(`/api/slates/${id}/entry`),
  saveEntry: (id: number, picks: unknown[]) => api.post(`/api/slates/${id}/entry`, { picks }),
  submitEntry: (id: number) => api.post(`/api/slates/${id}/entry/submit`),
  getLeaderboard: (id: number, page = 1, per_page = 25) =>
    api.get(`/api/slates/${id}/leaderboard`, { params: { page, per_page } }),
};

// ── Games ─────────────────────────────────────────────────────────────────────
export const gamesApi = {
  getById: (id: number) => api.get(`/api/games/${id}`),
  getLineups: (id: number) => api.get(`/api/games/${id}/lineups`),
  getLineupStatus: (id: number) => api.get(`/api/games/${id}/lineups/status`),
};

// ── BTS ───────────────────────────────────────────────────────────────────────
export const btsApi = {
  getToday: () => api.get("/api/bts/today"),
  submitEntry: (player_ids: number[]) => api.post("/api/bts/entry", { player_ids }),
  getMe: () => api.get("/api/bts/me"),
  getLeaderboard: () => api.get("/api/bts/leaderboard"),
};

// ── Weeks ─────────────────────────────────────────────────────────────────────
export const weeksApi = {
  getCurrent: () => api.get("/api/weeks/current"),
  getById: (id: number) => api.get(`/api/weeks/${id}`),
  getLeaderboard: (id: number, page = 1) =>
    api.get(`/api/weeks/${id}/leaderboard`, { params: { page } }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getProfile: (id: string) => api.get(`/api/users/${id}/profile`),
  getHistory: (id: string) => api.get(`/api/users/${id}/history`),
  getWins: (id: string) => api.get(`/api/users/${id}/wins`),
};

// ── Fan Games ──────────────────────────────────────────────────────────────────
export const fanGamesApi = {
  // Shared
  playerSearch: (q: string) =>
    api.get("/api/fan-games/players/search", { params: { q } }),

  // Immaculate Grid
  gridToday: () => api.get("/api/fan-games/grid/today"),
  gridGuess: (data: { row: number; col: number; player_id: string }) =>
    api.post("/api/fan-games/grid/guess", data),
  gridResult: () => api.get("/api/fan-games/grid/result"),
  gridAnswers: () => api.get("/api/fan-games/grid/answers"),
  gridLeaderboard: () => api.get("/api/fan-games/grid/leaderboard"),

  // Guess the Player
  guessToday: () => api.get("/api/fan-games/guess/today"),
  guessSubmit: (player_id: number) =>
    api.post("/api/fan-games/guess/submit", { player_id }),
  guessResult: () => api.get("/api/fan-games/guess/result"),
  guessLeaderboard: () => api.get("/api/fan-games/guess/leaderboard"),

  // Target Line
  targetToday: () => api.get("/api/fan-games/target/today"),
  targetPlayers: (q?: string) =>
    api.get("/api/fan-games/target/players", { params: { q } }),
  targetSubmit: (player_ids: number[]) =>
    api.post("/api/fan-games/target/submit", { player_ids }),
  targetSubmitSelections: (player_selections: { player_id: string; season: string }[]) =>
    api.post("/api/fan-games/target/submit", { player_selections }),
  targetResult: () => api.get("/api/fan-games/target/result"),
  targetLeaderboard: () => api.get("/api/fan-games/target/leaderboard"),

  // Higher or Lower
  higherLowerSeasons: () => api.get("/api/fan-games/higher-lower/seasons"),
  higherLowerPair: (seasons?: string[]) =>
    api.get("/api/fan-games/higher-lower/pair", {
      params: seasons && seasons.length ? { seasons } : {},
      paramsSerializer: (p) => Object.entries(p).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => `${k}=${encodeURIComponent(x)}`) : [`${k}=${encodeURIComponent(v as string)}`])).join("&"),
    }),
  higherLowerAnswer: (data: {
    player_a_id: number;
    player_b_id: number;
    stat_key: string;
    answer: string;
    season_a?: string | null;
    season_b?: string | null;
  }) => api.post("/api/fan-games/higher-lower/answer", data),
  higherLowerScore: (streak: number) =>
    api.post("/api/fan-games/higher-lower/score", { streak }),
  higherLowerLeaderboard: () =>
    api.get("/api/fan-games/higher-lower/leaderboard"),

  // Connections
  connectionsToday: () => api.get("/api/fan-games/connections/today"),
  connectionsGuess: (group_id: string, names: string[]) =>
    api.post("/api/fan-games/connections/guess", { group_id, names }),
  connectionsAnswers: () => api.get("/api/fan-games/connections/answers"),
  connectionsGiveUp: () => api.post("/api/fan-games/connections/giveup", {}),
  connectionsLeaderboard: () => api.get("/api/fan-games/connections/leaderboard"),

  // Name the Roster
  rosterToday: () => api.get("/api/fan-games/roster/today"),
  rosterGuess: (name: string) =>
    api.post("/api/fan-games/roster/guess", { name }),
  rosterComplete: () => api.post("/api/fan-games/roster/complete", {}),
  rosterLeaderboard: () => api.get("/api/fan-games/roster/leaderboard"),

  // Franchise Journey
  journeyToday: () => api.get("/api/fan-games/journey/today"),
  journeyClue: () => api.post("/api/fan-games/journey/clue", {}),
  journeyGuess: (player_id: number) =>
    api.post("/api/fan-games/journey/guess", { player_id }),
  journeyResult: () => api.get("/api/fan-games/journey/result"),
  journeyLeaderboard: () => api.get("/api/fan-games/journey/leaderboard"),
};
