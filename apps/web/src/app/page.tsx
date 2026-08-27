'use client';

import { useState } from 'react';
import { Board } from '@/components/Board';
import { Library } from '@/components/Library';
import { SidePanel } from '@/components/SidePanel';
import { Toolbar } from '@/components/Toolbar';

export default function Page() {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col">
      <Toolbar onOpenLibrary={() => setLibraryOpen(true)} onTogglePanel={() => setPanelOpen((v) => !v)} />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <Board />
        </main>
        <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </div>
      {libraryOpen && <Library onClose={() => setLibraryOpen(false)} />}
    </div>
  );
}
