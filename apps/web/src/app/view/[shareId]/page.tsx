'use client';

import { use, useEffect, useState } from 'react';
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
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 bg-bench-900/80 px-4 py-2.5">
        <span className="text-sm font-bold text-slate-100">{name ?? 'Shared circuit'}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          shared copy
        </span>
        <button
          type="button"
          onClick={() => setBreaker(true)}
          className="ml-auto rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
        >
          Close breaker and run
        </button>
      </header>
      {error && <p className="p-4 text-sm text-red-300">{error}</p>}
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <Board />
        </main>
        <SidePanel />
      </div>
    </div>
  );
}
