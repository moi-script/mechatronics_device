'use client';

import { useEffect } from 'react';
import { useTheme } from '@/store/useTheme';

/** Adopts the theme the pre-paint script chose, then follows the OS if asked to. */
export function ThemeSync() {
  const sync = useTheme((s) => s.sync);
  useEffect(() => sync(), [sync]);
  return null;
}
