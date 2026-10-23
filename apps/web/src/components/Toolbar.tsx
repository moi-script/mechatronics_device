'use client';

import { useState } from 'react';
import clsx from 'clsx';
import {
  Eraser,
  FilePlus2,
  FolderOpen,
  Info,
  FileDown,
  MoreHorizontal,
  Monitor,
  PackagePlus,
  Moon,
  PanelRight,
  Power,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Share2,
  Sun,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useBoard } from '@/store/useBoard';
import { useTheme } from '@/store/useTheme';
import { useSound } from '@/store/useSound';
import { useSession } from '@/store/useSession';
import { api, hasCloudSession, OFFLINE, SITE_URL } from '@/lib/api';
import { exportCircuit } from '@/lib/projectFile';
import { AboutDialog } from './AboutDialog';
import { BrandMark } from './BrandMark';
import { Popover } from './Popover';
import { WirePicker } from './WirePicker';
import { SessionTimer } from './SessionTimer';
import { ConfirmDialog } from './ConfirmDialog';
import { ShareDialog } from './ShareDialog';
import { PromptDialog } from './PromptDialog';
import { SubmitDialog } from './SubmitDialog';
import { BOARDS, boardOf } from '@/lib/boards';
import type { BoardType } from '@mech/sim';

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
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger' && 'border-safety-red/40 bg-safety-red/10 text-safety-red hover:bg-safety-red/20',
        // Save is the one action the bench is built around, so it is the one solid button.
        tone === 'go' && 'border-transparent bg-signal-amber font-bold text-[#1a1204] hover:brightness-110',
        tone === 'plain' && 'border-steel-400 bg-steel-100 text-carbon-900 hover:bg-steel-200',
      )}
    >
      {children}
    </button>
  );
}

/** One line of the overflow menu: an icon, a label, and an optional aside. */
function MenuItem({
  onClick,
  icon,
  children,
  aside,
  disabled,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'text-safety-red hover:bg-safety-red/10' : 'text-carbon-800 hover:bg-steel-200',
      )}
    >
      <span className="text-carbon-600">{icon}</span>
      <span className="flex-1">{children}</span>
      {aside && <span className="font-mono text-[10px] text-carbon-600">{aside}</span>}
    </button>
  );
}

export function Toolbar({
  onOpenLibrary,
  onOpenParts,
  onTogglePanel,
}: {
  onOpenLibrary: () => void;
  onOpenParts: () => void;
  onTogglePanel: () => void;
}) {
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
  const moduleCount = useBoard((s) => s.circuit.modules.length);
  const setHint = useBoard((s) => s.setHint);
  const newProject = useBoard((s) => s.newProject);
  const ensureSession = useSession((s) => s.ensure);
  const user = useSession((s) => s.user);
  /** What a circuit is called when nobody names it: whoever made it, so an instructor knows whose it is. */
  const defaultName = user && user.id !== 'device' ? user.name : 'Untitled circuit';
  const named = (name: string) => (name === 'Untitled circuit' ? defaultName : name);
  const choice = useTheme((s) => s.choice);
  const setChoice = useTheme((s) => s.setChoice);
  const soundOn = useSound((s) => s.enabled);
  const setSoundEnabled = useSound((s) => s.setEnabled);

  const savedId = useBoard((s) => s.savedCircuitId);
  const dirty = useBoard((s) => s.dirty);
  const setSavedId = useBoard((s) => s.setSavedCircuitId);
  const [busy, setBusy] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  /** The bench a new project is waiting on, while its confirm is open. */
  const [confirmingNew, setConfirmingNew] = useState<BoardType | null>(null);
  const board = useBoard((s) => s.circuit.board ?? 'trainer');
  const [namingCircuit, setNamingCircuit] = useState(false);
  const [namingFile, setNamingFile] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  /** Set when Share triggered the save, so the link follows automatically. */
  const [shareAfterSave, setShareAfterSave] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startSubmit = async () => {
    const u = await ensureSession();
    if (!u || u.id === 'device') {
      setHint('Submitting goes through your account, so your instructor knows it is yours. Sign in first.');
      onOpenLibrary();
      return;
    }
    setSubmitting(true);
  };

  /** Errors are left to throw, so the dialog stays open and shows them. */
  const submit = async (d: { code: string; name: string; info: Record<string, string> }) => {
    const out = await api.submit({ ...d, name: named(d.name), circuit: useBoard.getState().circuit });
    setSubmitting(false);
    setHint(`${out.replaced ? 'Resubmitted' : 'Submitted'} "${out.name}" to ${out.to}.`);
  };

  const linkFor = async (id: string) => {
    const { shareId } = await api.share(id);
    // A share link is served by the website, which the app is not: inside the
    // APK the origin is the webview's own, so the site's address is used.
    const origin = OFFLINE ? SITE_URL : window.location.origin;
    setShareUrl(`${origin}/view/${shareId}`);
  };

  /** The board as it stands, handed to the device as a file under a name. */
  const saveToFile = async (name: string) => {
    setBusy(true);
    try {
      const how = await exportCircuit(named(name), useBoard.getState().circuit);
      setNamingFile(false);
      setHint(
        how === 'shared'
          ? 'Circuit file ready to send.'
          : 'Circuit saved as a file. Send it to anyone, or open it on another device.',
      );
    } catch (err) {
      setHint((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      // Saving is tied to an account, so ask for one before anything else.
      // The session is already resolved at boot, so this normally costs nothing.
      const user = await ensureSession();
      if (!user) {
        setHint('Circuits are saved to your account. Sign in or register to keep this one.');
        onOpenLibrary();
        return;
      }

      if (savedId) {
        await api.updateCircuit(savedId, { circuit: useBoard.getState().circuit });
        setHint('Saved.');
        return;
      }

      // First save of this circuit: ask what to call it.
      setNamingCircuit(true);
    } catch (err) {
      setHint((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveAs = async (typed: string) => {
    const name = named(typed);
    setBusy(true);
    try {
      const { id } = await api.createCircuit({ name, circuit: useBoard.getState().circuit });
      setSavedId(id);
      setNamingCircuit(false);
      if (shareAfterSave) {
        setShareAfterSave(false);
        await linkFor(id);
      } else {
        setHint(`Saved as "${name}".`);
      }
    } catch (err) {
      setHint((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startNewProject = (type: BoardType = board) => {
    newProject(type);
    setConfirmingNew(null);
    setHint(boardOf(type).name + ' started. Save it to keep it under its own name.');
  };

  const askNewProject = (type: BoardType) => (wireCount > 0 ? setConfirmingNew(type) : startNewProject(type));

  const share = async () => {
    setBusy(true);
    try {
      const user = await ensureSession();
      if (!user) {
        setHint('Sharing needs an account, since the circuit is served from your saved copy.');
        onOpenLibrary();
        return;
      }

      // A circuit has to exist on the server before it can be linked to, so
      // fold the save into the same action rather than refusing.
      if (!savedId) {
        setShareAfterSave(true);
        setNamingCircuit(true);
        return;
      }

      await api.updateCircuit(savedId, { circuit: useBoard.getState().circuit });
      await linkFor(savedId);
    } catch (err) {
      setHint((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="border-b border-steel-300 bg-steel-50 px-2 py-1.5 sm:px-4 sm:py-2">
      {/*
        Two tidy rows on a phone and one on a desktop: the panel's power on the
        first, everything to do with wiring on the second. Each row is a full
        width block below sm, so nothing wraps into an odd half-line.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <BrandMark className="h-7 w-7 shrink-0" />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-[14px] font-bold tracking-[0.02em] text-carbon-900">Mechatronic Trainer</span>
            <span className="text-[11px] text-carbon-600">
              {boardOf(board).name} · {savedId ? (dirty ? 'unsaved changes' : 'saved') : 'unsaved'}
            </span>
          </div>
          <div className="hidden h-7 w-px bg-steel-300 sm:block" />

          <div role="group" aria-label="Power" className="flex items-center gap-1 rounded-[10px] border border-steel-300 bg-steel-100 p-1">
            <button
              type="button"
              onClick={() => setBreaker(!breakerOn)}
              className={clsx(
                'inline-flex h-8 items-center gap-2 rounded-[7px] px-3 font-cond text-xs font-bold tracking-[0.1em] transition',
                breakerOn && !tripped ? 'bg-run-green/15 text-run-green' : 'text-carbon-800 hover:bg-steel-200',
              )}
            >
              <span
                className={clsx('h-2 w-2 rounded-full', breakerOn && !tripped ? 'bg-run-green shadow-[0_0_8px_var(--color-run-green)]' : 'bg-steel-500')}
              />
              <Power className="h-3.5 w-3.5 sm:hidden" />
              BREAKER {breakerOn ? 'ON' : 'OFF'}
            </button>

            {tripped && (
              <Btn onClick={resetBreaker} tone="danger" title="Clear the fault and re-close the breaker">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Btn>
            )}

            <SessionTimer />
          </div>
        </div>

        <div className="hidden h-5 w-px bg-steel-400 sm:block" />

        {/* Which bench is on the screen. Switching starts a fresh project on it. */}
        <div role="radiogroup" aria-label="Board" className="flex w-full rounded-[10px] border border-steel-300 bg-steel-100 p-1 sm:w-auto">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={board === b.id}
              title={b.name + ' — ' + b.blurb}
              onClick={() => board !== b.id && askNewProject(b.id)}
              className={clsx(
                'h-8 flex-1 whitespace-nowrap rounded-[7px] px-3 text-xs font-semibold transition sm:flex-none',
                board === b.id ? 'bg-steel-50 text-carbon-900 shadow-sm ring-1 ring-signal-amber/60' : 'text-carbon-600 hover:text-carbon-900',
              )}
            >
              <span className="xl:hidden">{b.short}</span>
              <span className="hidden xl:inline">{b.name}</span>
            </button>
          ))}
        </div>

        <div className="hidden h-5 w-px bg-steel-400 sm:block" />

        <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-1">
          <div role="group" aria-label="Wiring" className="flex items-center gap-1 rounded-[10px] border border-steel-300 bg-steel-100 p-1">
          <WirePicker />

          <Btn
            onClick={() => selectedWireId && deleteWire(selectedWireId)}
            tone="danger"
            disabled={!selectedWireId}
            title="Delete the selected lead"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Delete lead</span>
          </Btn>

          <div className="hidden items-center gap-1 md:flex">
            <Btn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 className="h-3.5 w-3.5" />
            </Btn>
            <Btn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="h-3.5 w-3.5" />
            </Btn>
          </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden font-mono text-[11px] text-carbon-600 lg:inline">
              {String(wireCount).padStart(2, '0')} leads
            </span>
            <Btn onClick={onOpenParts} title="Add or remove bench components">
              <PackagePlus className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Components</span>
              <span className="rounded-md bg-steel-200 px-1.5 font-mono text-[10px] text-carbon-800">{moduleCount}</span>
            </Btn>
            <Btn onClick={onOpenLibrary} title="Saved circuits">
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Library</span>
            </Btn>
            <Btn onClick={save} tone="go" disabled={busy} title="Save this circuit">
              <Save className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Save</span>
            </Btn>

            {/* The rest of the bench's housekeeping, out of the way until asked for. */}
            <Popover
              title="More"
              align="right"
              panelClass="w-[212px]"
              trigger={<MoreHorizontal className="h-4 w-4" />}
              panel={(close) => (
                <div className="flex flex-col">
                  {(!OFFLINE || hasCloudSession()) && (
                    <MenuItem
                      icon={<Share2 className="h-3.5 w-3.5" />}
                      onClick={() => {
                        close();
                        void share();
                      }}
                    >
                      Share link
                    </MenuItem>
                  )}
                  {(!OFFLINE || hasCloudSession()) && (
                    <MenuItem
                      icon={<Send className="h-3.5 w-3.5" />}
                      onClick={() => {
                        close();
                        void startSubmit();
                      }}
                    >
                      Submit to instructor
                    </MenuItem>
                  )}
                  <MenuItem
                    icon={<FileDown className="h-3.5 w-3.5" />}
                    onClick={() => {
                      close();
                      setNamingFile(true);
                    }}
                  >
                    {OFFLINE ? 'Send as a file' : 'Save as a file'}
                  </MenuItem>
                  <MenuItem
                    icon={<FilePlus2 className="h-3.5 w-3.5" />}
                    onClick={() => {
                      close();
                      askNewProject(board);
                    }}
                  >
                    New project
                  </MenuItem>
                  <MenuItem
                    icon={<Eraser className="h-3.5 w-3.5" />}
                    danger
                    disabled={wireCount === 0}
                    aside={String(wireCount).padStart(2, '0')}
                    onClick={() => {
                      close();
                      setConfirmingClear(true);
                    }}
                  >
                    Clear all leads
                  </MenuItem>

                  <div className="my-1 h-px bg-steel-400" />

                  <MenuItem
                    icon={soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    aside={soundOn ? 'on' : 'muted'}
                    onClick={() => setSoundEnabled(!soundOn)}
                  >
                    Panel sounds
                  </MenuItem>
                  <MenuItem
                    icon={
                      choice === 'system' ? (
                        <Monitor className="h-3.5 w-3.5" />
                      ) : choice === 'light' ? (
                        <Sun className="h-3.5 w-3.5" />
                      ) : (
                        <Moon className="h-3.5 w-3.5" />
                      )
                    }
                    aside={choice}
                    onClick={() => setChoice(choice === 'system' ? 'light' : choice === 'light' ? 'dark' : 'system')}
                  >
                    Theme
                  </MenuItem>

                  <div className="my-1 h-px bg-steel-400" />

                  <MenuItem
                    icon={<Info className="h-3.5 w-3.5" />}
                    onClick={() => {
                      close();
                      setAboutOpen(true);
                    }}
                  >
                    About
                  </MenuItem>
                </div>
              )}
            />

            <button
              type="button"
              onClick={onTogglePanel}
              title="Status and exercises"
              aria-label="Status and exercises"
              className="inline-flex items-center rounded-md border border-steel-400 bg-steel-50 p-1.5 text-carbon-800 hover:bg-steel-200 xl:hidden"
            >
              <PanelRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}

      {shareUrl && <ShareDialog url={shareUrl} onClose={() => setShareUrl(null)} />}

      {namingCircuit && (
        <PromptDialog
          title={shareAfterSave ? 'Name it before sharing' : 'Save this circuit'}
          message={
            shareAfterSave
              ? 'A share link points at your saved copy, so this circuit needs a name first.'
              : OFFLINE && !hasCloudSession()
                ? 'It stays on this device, under My circuits in the library.'
                : 'It goes to your account, so you can pick it up on another machine.'
          }
          label="Circuit name"
          defaultValue={defaultName}
          placeholder="Start/stop latch"
          confirmLabel={shareAfterSave ? 'Save and get link' : 'Save circuit'}
          busy={busy}
          onSubmit={saveAs}
          onCancel={() => {
            setNamingCircuit(false);
            setShareAfterSave(false);
          }}
        />
      )}

      {namingFile && (
        <PromptDialog
          title="Save this circuit as a file"
          message="The file holds the whole board. Send it to a classmate, or open it on another device — no account needed at either end."
          label="Circuit name"
          defaultValue={defaultName}
          placeholder="Start/stop latch"
          confirmLabel={OFFLINE ? 'Send the file' : 'Save the file'}
          busy={busy}
          onSubmit={saveToFile}
          onCancel={() => setNamingFile(false)}
        />
      )}

      {submitting && <SubmitDialog defaultName={defaultName} onSubmit={submit} onCancel={() => setSubmitting(false)} />}

      {confirmingNew && (
        <ConfirmDialog
          title={confirmingNew === board ? 'Start a new project?' : 'Switch to the ' + boardOf(confirmingNew).name + '?'}
          message={`This clears ${
            wireCount === 1 ? 'the lead you have run' : 'all ' + wireCount + ' leads you have run'
          } and puts the standard bench parts back. The circuit you have saved stays in the library.`}
          detail="Save the board first if you want to keep this wiring."
          confirmLabel="Start new project"
          onConfirm={() => startNewProject(confirmingNew)}
          onCancel={() => setConfirmingNew(null)}
        />
      )}

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
