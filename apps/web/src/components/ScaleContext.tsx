'use client';

import { createContext } from 'react';

/** Current canvas zoom, so pointer deltas convert to board units. */
export const ScaleContext = createContext<() => number>(() => 1);
