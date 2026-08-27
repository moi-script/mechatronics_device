'use client';

import { useEffect } from 'react';
import { useTheme } from '@/store/useTheme';
import { useSound } from '@/store/useSound';

/** Adopts the stored theme and sound preferences once the client is up. */
export function PrefsSync() {
  const syncTheme = useTheme((s) => s.sync);
  const syncSound = useSound((s) => s.sync);

  useEffect(() => {
    syncTheme();
    syncSound();
  }, [syncTheme, syncSound]);

  return null;
}
