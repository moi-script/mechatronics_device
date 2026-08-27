'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { FolderOpen, PanelRight, Power, RotateCcw, Save, Share2, Trash2, Zap } from 'lucide-react';
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
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger' && 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
        tone === 'go' && 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        tone === 'plain' && 'border-paper-400 bg-white text-ink-700 hover:bg-paper-100',
      )}
    >
      {children}
    </button>
  );
}

export function Toolbar({ onOpenLibrary, onTogglePanel }: { onOpenLibrary: () => void; onTogglePanel: () => void }) {
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
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-paper-400 bg-white/90 px-3 py-2 backdrop-blur sm:px-4">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-sm font-bold tracking-tight text-ink-900">
          Mechatronic <span className="hidden sm:inline">Trainer</span>
        </span>
      </div>

      <div className="hidden h-5 w-px bg-paper-400 sm:block" />

      <button
        type="button"
        onClick={() => setBreaker(!breakerOn)}
        className={clsx(
          'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition',
          breakerOn && !tripped
            ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
            : 'border-paper-400 bg-white text-ink-500 hover:bg-paper-100',
        )}
      >
        <Power className="h-3.5 w-3.5" />
        <span className="hidden xs:inline sm:inline">BREAKER </span>
        {breakerOn ? 'ON' : 'OFF'}
      </button>

      {tripped && (
        <Btn onClick={resetBreaker} tone="danger" title="Clear the fault and re-close the breaker">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Btn>
      )}

      <div className="hidden h-5 w-px bg-paper-400 sm:block" />

      <div className="flex items-center gap-1.5">
        <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-ink-500 sm:inline">Wire</span>
        {WIRE_COLORS.map((c: WireColor) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setWireColor(c)}
            className={clsx(
              'h-6 w-6 rounded-full border-2 transition',
              wireColor === c ? 'scale-110 border-ink-900' : 'border-paper-400 hover:border-ink-500',
            )}
            style={{ backgroundColor: WIRE_HEX[c] }}
          />
        ))}
      </div>

      <Btn onClick={() => selectedWireId && deleteWire(selectedWireId)} tone="danger" disabled={!selectedWireId} title="Delete the selected lead">
        <Trash2 className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Delete lead</span>
      </Btn>

      <label className="flex items-center gap-1.5 text-xs text-ink-500">
        <span className="hidden md:inline">Timer delay</span>
        <span className="md:hidden">Timer</span>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={(delayMs / 1000).toFixed(1)}
          onChange={(e) => setTimerDelay(Math.max(100, Number(e.target.value) * 1000))}
          className="w-16 rounded-md border border-paper-400 bg-white px-2 py-1 text-right text-xs text-ink-900 outline-none focus:border-amber-500"
        />
        s
      </label>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-[11px] text-ink-500 lg:inline">{wireCount} leads</span>
        <Btn onClick={() => clearWires()} tone="danger" disabled={wireCount === 0}>
          <span className="hidden sm:inline">Clear all</span>
          <span className="sm:hidden">Clear</span>
        </Btn>
        <Btn onClick={onOpenLibrary} title="Saved circuits">
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Library</span>
        </Btn>
        <Btn onClick={save} tone="go" disabled={busy} title="Save this circuit">
          <Save className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Save</span>
        </Btn>
        <Btn onClick={share} title="Copy a share link">
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Share</span>
        </Btn>
        <button
          type="button"
          onClick={onTogglePanel}
          title="Status and exercises"
          className="inline-flex items-center rounded-lg border border-paper-400 bg-white p-1.5 text-ink-700 hover:bg-paper-100 xl:hidden"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
