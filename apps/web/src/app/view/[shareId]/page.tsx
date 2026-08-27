'use client';

import { use, useEffect, useState } from 'react';
import { PanelRight } from 'lucide-react';
import { Board } from '@/components/Board';
import { SidePanel } from '@/components/SidePanel';
import { useBoard } from '@/store/useBoard';
import { api } from '@/lib/api';

export default function SharedPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = use(params);
  const loadCircuit = useBoard((s) => s.loadCircuit);
  const setBreaker = useBoard((s) => s.setBreaker);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    api
      .shared(shareId)
      .then(({ circuit, name }) => {
        loadCircuit(circuit);
        setName(name);
      })
      .catch((e: Error) => setError(e.message));
  }, [shareId, loadCircuit]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-steel-400 bg-white/90 px-3 py-2 sm:px-4">
        <span className="text-sm font-bold text-carbon-900">{name ?? 'Shared circuit'}</span>
        <span className="rounded-full border border-steel-400 bg-steel-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-600">
          shared copy
        </span>
        <button
          type="button"
          onClick={() => setBreaker(true)}
          className="ml-auto rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          Close breaker and run
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="inline-flex items-center rounded-lg border border-steel-400 bg-white p-1.5 text-carbon-800 hover:bg-steel-100 xl:hidden"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </header>
      {error && <p className="p-4 text-sm text-red-700">{error}</p>}
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <Board />
        </main>
        <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </div>
    </div>
  );
}
