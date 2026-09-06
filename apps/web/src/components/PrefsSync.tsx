'use client';

import { useEffect } from 'react';
import { useTheme } from '@/store/useTheme';
import { useSound } from '@/store/useSound';
import { useSession } from '@/store/useSession';

/**
 * Adopts the stored theme and sound preferences once the client is up, and
 * resolves the session straight away so nothing later has to guess whether
 * the visitor is signed in.
 */
export function PrefsSync() {
  const syncTheme = useTheme((s) => s.sync);
  const syncSound = useSound((s) => s.sync);
  const ensureSession = useSession((s) => s.ensure);

  useEffect(() => {
    syncTheme();
    syncSound();
    void ensureSession();
  }, [syncTheme, syncSound, ensureSession]);

  return null;
}
