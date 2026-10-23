'use client';

import { useState } from 'react';
import { Board } from '@/components/Board';
import { LadderEditor } from '@/components/LadderEditor';
import { Library } from '@/components/Library';
import { PartsBin } from '@/components/PartsBin';
import { SidePanel } from '@/components/SidePanel';
import { Toolbar } from '@/components/Toolbar';
import { UpdateNotice } from '@/components/UpdateNotice';
import { useLadderEditor } from '@/store/useLadderEditor';

export function TrainerApp() {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [binOpen, setBinOpen] = useState(false);
  const ladderFor = useLadderEditor((s) => s.moduleId);
  const openLadder = useLadderEditor((s) => s.open);

  return (
    <div className="flex h-dvh flex-col">
      <Toolbar
        onOpenLibrary={() => setLibraryOpen(true)}
        onOpenParts={() => setBinOpen(true)}
        onTogglePanel={() => setPanelOpen((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1 overflow-hidden">
            <Board />
          </main>
          {ladderFor && <LadderEditor moduleId={ladderFor} onClose={() => openLadder(null)} />}
        </div>
        <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </div>
      {/* Only the installed app can be behind; on the site this renders nothing. */}
      <UpdateNotice />
      {binOpen && <PartsBin onClose={() => setBinOpen(false)} />}
      {libraryOpen && <Library onClose={() => setLibraryOpen(false)} />}
    </div>
  );
}
