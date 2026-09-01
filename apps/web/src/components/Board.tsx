'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Maximize2, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { PARTS } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { usePalette } from '@/store/useTheme';
import { BOARD_H, BOARD_W } from '@/lib/geometry';
import { ModuleView } from './ModuleView';
import { Wires } from './Wires';
import { ScaleContext } from './ScaleContext';
import { BoardDefs, BoardPlate } from './BoardPlate';

/** How often the board is re-solved while an on-delay timer is counting. */
const TICK_MS = 100;

export function Board() {
  const modules = useBoard((s) => s.circuit.modules);
  const timing = useBoard((s) => s.sim.nextTickMs !== null);
  const tick = useBoard((s) => s.tick);
  const setCursor = useBoard((s) => s.setCursor);
  const cancelWire = useBoard((s) => s.cancelWire);
  const selectWire = useBoard((s) => s.selectWire);
  const deleteWire = useBoard((s) => s.deleteWire);
  const undo = useBoard((s) => s.undo);
  const redo = useBoard((s) => s.redo);
  const canUndo = useBoard((s) => s.past.length > 0);
  const canRedo = useBoard((s) => s.future.length > 0);
  const palette = usePalette();

  /** Rubber band in board coordinates while a marquee drag is in progress. */
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** Holding space hands the left button back to panning. */
  const [panMode, setPanMode] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);
  /** Once the user pans or zooms, stop re-fitting the view out from under them. */
  const touched = useRef(false);
  const getScale = useCallback(() => zoomRef.current?.instance.transformState.scale ?? 1, []);

  /** Run the clock only while something is actually on it. */
  useEffect(() => {
    if (!timing) return;
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [timing, tick]);

  /**
   * Frame whatever is actually on the board, so a bench holding two parts is
   * not shown as two specks on an empty plate. With nothing down we fall back
   * to the whole plate.
   */
  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const down = useBoard.getState().circuit.modules;
    const pad = 60;
    let x0 = 0;
    let y0 = 0;
    let x1 = BOARD_W;
    let y1 = BOARD_H;
    if (down.length > 0) {
      x0 = Math.max(0, Math.min(...down.map((m) => m.x)) - pad);
      y0 = Math.max(0, Math.min(...down.map((m) => m.y)) - pad);
      x1 = Math.min(BOARD_W, Math.max(...down.map((m) => m.x + PARTS[m.type].width)) + pad);
      y1 = Math.min(BOARD_H, Math.max(...down.map((m) => m.y + PARTS[m.type].height)) + pad);
    }
    const w = Math.max(1, x1 - x0);
    const h = Math.max(1, y1 - y0);
    const scale = Math.min(1.1, Math.max(0.18, Math.min(host.clientWidth / w, host.clientHeight / h)));
    zoomRef.current?.setTransform(
      (host.clientWidth - w * scale) / 2 - x0 * scale,
      (host.clientHeight - h * scale) / 2 - y0 * scale,
      scale,
      0,
    );
  }, []);

  /** Re-frame when parts come out of the bin, unless the user has taken over. */
  useEffect(() => {
    if (touched.current) return;
    const id = setTimeout(fit, 40);
    return () => clearTimeout(id);
  }, [modules.length, fit]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const id = setTimeout(fit, 60);
    const ro = new ResizeObserver(() => {
      if (!touched.current) fit();
    });
    ro.observe(host);
    return () => {
      clearTimeout(id);
      ro.disconnect();
    };
  }, [fit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack keys while the user is typing into a field.
      const el = e.target as HTMLElement | null;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.isContentEditable === true;

      if (e.key === 'Escape') {
        cancelWire();
        selectWire(null);
        useBoard.getState().clearModuleSelection();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !typing) {
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }
        if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        const id = useBoard.getState().selectedWireId;
        if (id) {
          e.preventDefault();
          deleteWire(id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelWire, selectWire, deleteWire, undo, redo]);

  // Hold space to pan with the left button, the way drawing tools do.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest?.('input, textarea')) {
        e.preventDefault();
        setPanMode(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPanMode(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /** Screen pixels -> board units. */
  const toBoard = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  // So the trailing lead follows the cursor exactly.
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!useBoard.getState().pending) return;
      const p = toBoard(e.clientX, e.clientY);
      if (p) setCursor(p.x, p.y);
    },
    [setCursor, toBoard],
  );

  /**
   * Left-dragging empty board draws a marquee and selects whatever it touches.
   * Touch is left alone so one finger still pans the board on a phone.
   */
  const onBackgroundDown = useCallback(
    (e: React.PointerEvent) => {
      cancelWire();
      selectWire(null);

      if (e.pointerType !== 'mouse' || e.button !== 0 || panMode) return;
      const start = toBoard(e.clientX, e.clientY);
      if (!start) return;

      if (!e.shiftKey) useBoard.getState().clearModuleSelection();
      const base = e.shiftKey ? useBoard.getState().selectedModuleIds : [];
      setMarquee({ x0: start.x, y0: start.y, x1: start.x, y1: start.y });

      const onMove = (ev: PointerEvent) => {
        const p = toBoard(ev.clientX, ev.clientY);
        if (!p) return;
        setMarquee({ x0: start.x, y0: start.y, x1: p.x, y1: p.y });

        const left = Math.min(start.x, p.x);
        const right = Math.max(start.x, p.x);
        const top = Math.min(start.y, p.y);
        const bottom = Math.max(start.y, p.y);

        const hit = useBoard
          .getState()
          .circuit.modules.filter((m) => {
            const part = PARTS[m.type];
            return m.x < right && m.x + part.width > left && m.y < bottom && m.y + part.height > top;
          })
          .map((m) => m.id);

        useBoard.getState().setSelectedModules([...new Set([...base, ...hit])]);
      };

      const onUp = () => {
        setMarquee(null);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [cancelWire, selectWire, panMode, toBoard],
  );

  // 44px on touch screens so the targets clear the accessibility minimum.
  const ctlBtn =
    'flex h-11 w-11 items-center justify-center rounded-md border border-steel-400 bg-steel-50/95 text-carbon-600 shadow-sm transition hover:bg-steel-200 hover:text-carbon-900 disabled:opacity-35 disabled:hover:bg-steel-50/95 md:h-9 md:w-9';

  return (
    <ScaleContext.Provider value={getScale}>
      <div ref={hostRef} className="relative h-full w-full">
        <TransformWrapper
          ref={zoomRef}
          minScale={0.15}
          maxScale={2.5}
          initialScale={0.6}
          limitToBounds={false}
          centerOnInit
          doubleClick={{ disabled: true }}
          panning={{
            excluded: ['no-pan'],
            velocityDisabled: true,
            // The left button draws a marquee instead; space or the middle
            // button still pans, and touch is unaffected.
            allowLeftClickPan: panMode,
            allowMiddleClickPan: true,
          }}
          wheel={{ step: 0.08 }}
          pinch={{ step: 4 }}
          onPanningStart={() => {
            touched.current = true;
          }}
          onZoomStart={() => {
            touched.current = true;
          }}
        >
          <TransformComponent wrapperClass="!w-full !h-full board-grid" contentClass="!w-auto !h-auto">
            <svg
              ref={svgRef}
              width={BOARD_W}
              height={BOARD_H}
              viewBox={'0 0 ' + BOARD_W + ' ' + BOARD_H}
              className="max-w-none shrink-0"
              onPointerMove={onPointerMove}
              onPointerDown={onBackgroundDown}
              style={{ width: BOARD_W, height: BOARD_H, cursor: panMode ? 'grab' : 'default' }}
            >
              <BoardDefs />

              <BoardPlate />
              {modules.map((m) => (
                <ModuleView key={m.id} m={m} />
              ))}
              <Wires />

              {marquee && (
                <rect
                  x={Math.min(marquee.x0, marquee.x1)}
                  y={Math.min(marquee.y0, marquee.y1)}
                  width={Math.abs(marquee.x1 - marquee.x0)}
                  height={Math.abs(marquee.y1 - marquee.y0)}
                  fill={palette.amber}
                  fillOpacity={0.08}
                  stroke={palette.amber}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  pointerEvents="none"
                />
              )}
            </svg>
          </TransformComponent>
        </TransformWrapper>

        {/* Bottom right, within thumb reach. Undo and redo only appear here on
            small screens, where the toolbar has no room for them. */}
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5 md:hidden">
            <button type="button" title="Undo" aria-label="Undo" className={ctlBtn} onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-5 w-5" />
            </button>
            <button type="button" title="Redo" aria-label="Redo" className={ctlBtn} onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-5 w-5" />
            </button>
          </div>
          <div className="flex gap-1.5">
            <button type="button" title="Zoom out" aria-label="Zoom out" className={ctlBtn} onClick={() => zoomRef.current?.zoomOut(0.2)}>
              <Minus className="h-5 w-5 md:h-4 md:w-4" />
            </button>
            <button type="button" title="Zoom in" aria-label="Zoom in" className={ctlBtn} onClick={() => zoomRef.current?.zoomIn(0.2)}>
              <Plus className="h-5 w-5 md:h-4 md:w-4" />
            </button>
            <button
              type="button"
              title="Fit the whole board"
              aria-label="Fit the whole board"
              className={ctlBtn}
              onClick={() => {
                touched.current = false;
                fit();
              }}
            >
              <Maximize2 className="h-5 w-5 md:h-4 md:w-4" />
            </button>
          </div>
        </div>
      </div>
    </ScaleContext.Provider>
  );
}
