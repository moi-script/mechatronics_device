'use client';

import { useState } from 'react';
import clsx from 'clsx';
import {
  FolderOpen,
  Monitor,
  Moon,
  PanelRight,
  Power,
  Redo2,
  RotateCcw,
  Save,
  Share2,
  Sun,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react';
import { WIRE_COLORS, type WireColor } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { useTheme, useWireColors } from '@/store/useTheme';
import { api } from '@/lib/api';
import { SessionTimer } from './SessionTimer';
import { ConfirmDialog } from './ConfirmDialog';

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
        'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger' && 'border-safety-red/40 bg-safety-red/10 text-safety-red hover:bg-safety-red/20',
        tone === 'go' && 'border-run-green/40 bg-run-green/10 text-run-green hover:bg-run-green/20',
        tone === 'plain' && 'border-steel-400 bg-steel-50 text-carbon-800 hover:bg-steel-200',
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
  const undo = useBoard((s) => s.undo);
  const redo = useBoard((s) => s.redo);
  const canUndo = useBoard((s) => s.past.length > 0);
  const canRedo = useBoard((s) => s.future.length > 0);
  const wireCount = useBoard((s) => s.circuit.wires.length);
  const setHint = useBoard((s) => s.setHint);
  const WIRE_HEX = useWireColors();
  const choice = useTheme((s) => s.choice);
  const setChoice = useTheme((s) => s.setChoice);

  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      // Saving is tied to an account, so ask for one before anything else.
      const { user } = await api.me();
      if (!user) {
        setHint('Circuits are saved to your account. Sign in or register to keep this one.');
        onOpenLibrary();
        return;
      }

      const { circuit } = useBoard.getState();
      if (savedId) {
        await api.updateCircuit(savedId, { circuit });
        setHint('Saved.');
        return;
      }

      const name = window.prompt('Name this circuit', 'Untitled circuit');
      if (!name?.trim()) return;
      const { id } = await api.createCircuit({ name: name.trim(), circuit });
      setSavedId(id);
      setHint('Saved as "' + name.trim() + '".');
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
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-carbon-900 bg-steel-50 px-3 py-2 sm:px-4">
      <div className="flex items-center gap-2">

        <span className="engraved text-[13px] font-bold text-carbon-900">
          Mechatronic <span className="hidden sm:inline"></span>
        </span>
      </div>

      <div className="hidden h-5 w-px bg-steel-400 sm:block" />

      <button
        type="button"
        onClick={() => setBreaker(!breakerOn)}
        className={clsx(
          'engraved inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-xs font-bold transition',
          breakerOn && !tripped
            ? 'border-run-green bg-run-green/15 text-run-green'
            : 'border-steel-400 bg-steel-50 text-carbon-600 hover:bg-steel-200',
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

      <div className="hidden h-5 w-px bg-steel-400 sm:block" />

      <div className="flex items-center gap-1.5">
        <span className="engraved hidden text-[10px] font-semibold text-carbon-600 sm:inline">Lead</span>
        {WIRE_COLORS.map((c: WireColor) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setWireColor(c)}
            className={clsx(
              'h-6 w-6 rounded-full border-2 transition',
              wireColor === c ? 'scale-110 border-carbon-900' : 'border-steel-400 hover:border-carbon-600',
            )}
            style={{ backgroundColor: WIRE_HEX[c] }}
          />
        ))}
      </div>

      <Btn onClick={() => selectedWireId && deleteWire(selectedWireId)} tone="danger" disabled={!selectedWireId} title="Delete the selected lead">
        <Trash2 className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Delete lead</span>
      </Btn>

      <div className="flex items-center gap-1">
        <Btn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="h-3.5 w-3.5" />
        </Btn>
      </div>

      <SessionTimer />

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden font-mono text-[11px] text-carbon-600 lg:inline">{String(wireCount).padStart(2, '0')} leads</span>
        <Btn onClick={() => setConfirmingClear(true)} tone="danger" disabled={wireCount === 0}>
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
          onClick={() => setChoice(choice === 'system' ? 'light' : choice === 'light' ? 'dark' : 'system')}
          title={'Theme: ' + choice + ' (click to change)'}
          aria-label={'Theme: ' + choice}
          className="inline-flex items-center rounded-sm border border-steel-400 bg-steel-50 p-1.5 text-carbon-800 hover:bg-steel-200"
        >
          {choice === 'system' ? (
            <Monitor className="h-4 w-4" />
          ) : choice === 'light' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onTogglePanel}
          title="Status and exercises"
          className="inline-flex items-center rounded-sm border border-steel-400 bg-steel-50 p-1.5 text-carbon-800 hover:bg-steel-200 xl:hidden"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>

      {confirmingClear && (
        <ConfirmDialog
          title="Clear the whole board?"
          message={`This removes ${wireCount === 1 ? 'the only lead' : 'all ' + wireCount + ' leads'} from the board. The modules stay where they are.`}
          detail="You can undo this with Ctrl+Z."
          confirmLabel={wireCount === 1 ? 'Remove the lead' : 'Remove all leads'}
          onConfirm={() => {
            clearWires();
            setConfirmingClear(false);
            setHint('Board cleared. Ctrl+Z brings the leads back.');
          }}
          onCancel={() => setConfirmingClear(false)}
        />
      )}
    </header>
  );
}
