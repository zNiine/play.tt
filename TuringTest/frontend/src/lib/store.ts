import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: "turing-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

interface SlateState {
  activePicks: Record<number, unknown>;
  totalSalary: number;
  addPick: (slot: number, pick: unknown, salary: number) => void;
  removePick: (slot: number, salary: number) => void;
  clearPicks: () => void;
}

export const useSlateStore = create<SlateState>()((set) => ({
  activePicks: {},
  totalSalary: 0,
  addPick: (slot, pick, salary) =>
    set((s) => ({
      activePicks: { ...s.activePicks, [slot]: pick },
      totalSalary: s.totalSalary + salary,
    })),
  removePick: (slot, salary) =>
    set((s) => {
      const picks = { ...s.activePicks };
      delete picks[slot];
      return { activePicks: picks, totalSalary: s.totalSalary - salary };
    }),
  clearPicks: () => set({ activePicks: {}, totalSalary: 0 }),
}));
