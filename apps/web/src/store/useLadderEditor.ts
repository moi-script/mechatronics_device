'use client';

import { create } from 'zustand';

/** Which PLC's ladder editor is open, if any. The PLC face opens it; TrainerApp mounts it. */
export const useLadderEditor = create<{ moduleId: string | null; open(id: string | null): void }>((set) => ({
  moduleId: null,
  open: (moduleId) => set({ moduleId }),
}));
