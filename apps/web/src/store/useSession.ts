'use client';

import { create } from 'zustand';
import { api, type User } from '@/lib/api';

/**
 * 'unknown' only ever shows before the first /auth/me lands. Screens that
 * branch on the user must wait it out rather than assume signed out, or a
 * signed-in visitor gets a flash of the sign-in form.
 */
export type SessionStatus = 'unknown' | 'ready' | 'error';

/**
 * The free Render API sleeps when idle and takes up to a minute to start, so a
 * failed /auth/me is retried for this long before we call it unreachable.
 */
const WAKE_WINDOW_MS = 90_000;
const RETRY_EVERY_MS = 5_000;

const UNREACHABLE =
  process.env.NODE_ENV === 'development'
    ? 'The API is not reachable. Start it with npm run dev:api.'
    : "The server didn't wake up. Try again in a minute.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SessionStore {
  user: User | null;
  status: SessionStatus;
  error: string | null;
  /** True while retrying a server that is still starting up. */
  waking: boolean;
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
    inFlight = (async () => {
      const deadline = Date.now() + WAKE_WINDOW_MS;
      for (;;) {
        try {
          const { user } = await api.me();
          set({ user, status: 'ready', error: null, waking: false });
          return user;
        } catch {
          // /auth/me answers signed-out visitors with { user: null }, so any
          // failure here means the server itself is down or still waking.
          if (Date.now() + RETRY_EVERY_MS > deadline) {
            set({ user: null, status: 'error', error: UNREACHABLE, waking: false });
            return null;
          }
          set({ waking: true });
          await sleep(RETRY_EVERY_MS);
        }
      }
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    user: null,
    status: 'unknown',
    error: null,
    waking: false,

    ensure: () => (get().status === 'ready' ? Promise.resolve(get().user) : fetchUser()),
    refresh: fetchUser,
    setUser: (user) => set({ user, status: 'ready', error: null }),

    signOut: async () => {
      await api.logout();
      set({ user: null, status: 'ready', error: null });
    },
  };
});
