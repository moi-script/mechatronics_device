'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Power, RotateCcw, Save, Trash2, Share2, FolderOpen, Zap } from 'lucide-react';
import { WIRE_COLORS, type WireColor } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { WIRE_HEX } from '@/lib/geometry';
import { api } from '@/lib/api';

function Btn({
  onClick,
  children,
  title,
  tone = 'plain',
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  tone?: 'plain' | 'danger' | 'go';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger' && 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
        tone === 'go' && 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
        tone === 'plain' && 'bg-white/5 text-slate-300 hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

export function Toolbar({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const breakerOn = useBoard((s) => s.breakerOn);
  const tripped = useBoard((s) => s.tripped);
  const setBreaker = useBoard((s) => s.setBreaker);
  const resetBreaker = useBoard((s) => s.resetBreaker);
  const wireColor = useBoard((s) => s.wireColor);
  const setWireColor = useBoard((s) => s.setWireColor);
  const selectedWireId = useBoard((s) => s.selectedWireId);
  const deleteWire = useBoard((s) => s.deleteWire);
  const clearWires = useBoard((s) => s.clearWires);
  const wireCount = useBoard((s) => s.circuit.wires.length);
  const delayMs = useBoard((s) => s.circuit.timerDelayMs);
  const setTimerDelay = useBoard((s) => s.setTimerDelay);
  const setHint = useBoard((s) => s.setHint);

  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { circuit } = useBoard.getState();
      if (savedId) {
        await api.updateCircuit(savedId, { circuit });
        setHint('Saved.');
      } else {
        const name = window.prompt('Name this circuit', 'Untitled circuit');
        if (!name) return;
        const { id } = await api.createCircuit({ name, circuit });
        setSavedId(id);
        setHint('Saved as "' + name + '".');
      }
    } catch (err) {
      setHint((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!savedId) {
      setHint('Save the circuit before sharing it.');
      return;
    }
    try {
      const { shareId } = await api.share(savedId);
      const url = window.location.origin + '/view/' + shareId;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setHint('Share link copied: ' + url);
    } catch (err) {
      setHint((err as Error).message);
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-bench-900/80 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-bold tracking-wide text-slate-100">Mechatronic Trainer</span>
      </div>

      <div className="h-5 w-px bg-white/10" />

      <button
        type="button"
        onClick={() => setBreaker(!breakerOn)}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition',
          breakerOn && !tripped ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400 hover:bg-white/10',
        )}
      >
        <Power className="h-3.5 w-3.5" />
        {breakerOn ? 'BREAKER ON' : 'BREAKER OFF'}
      </button>

      {tripped && (
        <Btn onClick={resetBreaker} tone="danger" title="Clear the fault and re-close the breaker">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset breaker
        </Btn>
      )}

      <div className="h-5 w-px bg-white/10" />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Wire</span>
        {WIRE_COLORS.map((c: WireColor) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setWireColor(c)}
            className={clsx(
              'h-6 w-6 rounded-full border-2 transition',
              wireColor === c ? 'border-white scale-110' : 'border-white/20 hover:border-white/50',
            )}
            style={{ backgroundColor: WIRE_HEX[c] }}
          />
        ))}
      </div>

      <Btn onClick={() => selectedWireId && deleteWire(selectedWireId)} tone="danger" disabled={!selectedWireId}>
        <Trash2 className="h-3.5 w-3.5" />
        Delete lead
      </Btn>

      <div className="h-5 w-px bg-white/10" />

      <label className="flex items-center gap-2 text-xs text-slate-400">
        Timer delay
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={(delayMs / 1000).toFixed(1)}
          onChange={(e) => setTimerDelay(Math.max(100, Number(e.target.value) * 1000))}
          className="w-16 rounded-md bg-black/40 px-2 py-1 text-right text-xs text-slate-200 outline-none ring-1 ring-white/10 focus:ring-amber-400/60"
        />
        s
      </label>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-[11px] text-slate-500">{wireCount} leads</span>
        <Btn onClick={() => clearWires()} tone="danger" disabled={wireCount === 0}>
          Clear all
        </Btn>
        <Btn onClick={onOpenLibrary}>
          <FolderOpen className="h-3.5 w-3.5" />
          Library
        </Btn>
        <Btn onClick={save} tone="go" disabled={busy}>
          <Save className="h-3.5 w-3.5" />
          Save
        </Btn>
        <Btn onClick={share}>
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Btn>
      </div>
    </header>
  );
}
