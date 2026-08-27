'use client';

import { create } from 'zustand';
import { setMuted } from '@/lib/sound';

const KEY = 'mech-sound';

interface SoundStore {
  enabled: boolean;
  setEnabled(value: boolean): void;
  /** Adopt the stored preference on mount. */
  sync(): void;
}

export const useSound = create<SoundStore>((set) => ({
  // Starts on so the server and the first client render agree.
  enabled: true,

  setEnabled: (enabled) => {
    try {
      localStorage.setItem(KEY, enabled ? 'on' : 'off');
    } catch {
      // Blocked storage: the choice just won't persist.
    }
    setMuted(!enabled);
    set({ enabled });
  },

  sync: () => {
    let enabled = true;
    try {
      enabled = localStorage.getItem(KEY) !== 'off';
    } catch {
      // Default to audible.
    }
    setMuted(!enabled);
    set({ enabled });
  },
}));
