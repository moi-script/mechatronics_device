'use client';

import { create } from 'zustand';
import { api, type User } from '@/lib/api';

/**
 * 'unknown' only ever shows before the first /auth/me lands. Screens that
 * branch on the user must wait it out rather than assume signed out, or a
 * signed-in visitor gets a flash of the sign-in form.
 */
export type SessionStatus = 'unknown' | 'ready' | 'error';

interface SessionStore {
  user: User | null;
  status: SessionStatus;
  error: string | null;
  /** Resolve the session, reusing the answer we already have. */
  ensure(): Promise<User | null>;
  /** Ask the server again, e.g. after signing in on another tab. */
  refresh(): Promise<User | null>;
  setUser(u: User | null): void;
  signOut(): Promise<void>;
}

/** Held so several callers at once share one request instead of racing. */
let inFlight: Promise<User | null> | null = null;

export const useSession = create<SessionStore>((set, get) => {
  const fetchUser = () => {
    if (inFlight) return inFlight;
    inFlight = api
      .me()
      .then(({ user }) => {
        set({ user, status: 'ready', error: null });
        return user;
      })
      .catch(() => {
        set({ user: null, status: 'error', error: 'The API is not reachable. Start it with npm run dev:api.' });
        return null;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    user: null,
    status: 'unknown',
    error: null,

    ensure: () => (get().status === 'ready' ? Promise.resolve(get().user) : fetchUser()),
    refresh: fetchUser,
    setUser: (user) => set({ user, status: 'ready', error: null }),

    signOut: async () => {
      await api.logout();
      set({ user: null, status: 'ready', error: null });
    },
  };
});
