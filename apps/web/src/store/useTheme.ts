'use client';

import { create } from 'zustand';
import { usePhotoreal } from './useBoard';
import { LIGHT, PHOTO, paletteFor, WIRE_BY_MODE, WIRE_HI_BY_MODE, type Mode, type Palette, type ThemeChoice } from '@/lib/palette';

const KEY = 'mech-theme';

interface ThemeStore {
  /** What the user asked for; 'system' follows the OS. */
  choice: ThemeChoice;
  /** What that resolves to right now. */
  mode: Mode;
  setChoice(choice: ThemeChoice): void;
  /** Adopt whatever the pre-paint script already put on the document. */
  sync(): void;
}

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolve = (choice: ThemeChoice): Mode => (choice === 'system' ? (prefersDark() ? 'dark' : 'light') : choice);

const apply = (mode: Mode) => {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = mode;
};

export const useTheme = create<ThemeStore>((set, get) => ({
  // Starts light so the server and the first client render agree; sync() then
  // adopts the real value on mount.
  choice: 'system',
  mode: 'light',

  setChoice: (choice) => {
    const mode = resolve(choice);
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Private mode or blocked storage: the choice just won't persist.
    }
    apply(mode);
    set({ choice, mode });
  },

  sync: () => {
    // The Refined Workbench is a dark bench, so that is what a first visit sees.
    let stored: ThemeChoice = 'dark';
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw;
    } catch {
      // Blocked storage: stay on the default.
    }
    const mode = resolve(stored);
    apply(mode);
    set({ choice: stored, mode });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (get().choice !== 'system') return;
      const next = prefersDark() ? 'dark' : 'light';
      apply(next);
      set({ mode: next });
    };
    mq.addEventListener('change', onChange);
  },
}));

export const usePalette = (): Palette => {
  const mode = useTheme((s) => s.mode);
  return usePhotoreal() ? PHOTO : (paletteFor(mode) ?? LIGHT);
};
// Leads on the aluminium bench take the colours picked for a light panel.
const useLeadMode = (): Mode => {
  const mode = useTheme((s) => s.mode);
  return usePhotoreal() ? 'light' : mode;
};
export const useWireColors = () => WIRE_BY_MODE[useLeadMode()];
export const useWireHighlights = () => WIRE_HI_BY_MODE[useLeadMode()];
