'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Maximize2, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { PARTS } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { usePalette } from '@/store/useTheme';
import { BOARD_H, BOARD_W, CANVAS_H, CANVAS_PAD, CANVAS_W, GRID_MAJOR, GRID_MINOR, wireFocus } from '@/lib/geometry';
import { ModuleView } from './ModuleView';
import { Wires } from './Wires';
import { ScaleContext } from './ScaleContext';
import { BoardDefs, BoardPlate } from './BoardPlate';

/** How often the board is re-solved while an on-delay timer is counting. */
const TICK_MS = 100;

export function Board() {
  const modules = useBoard((s) => s.circuit.modules);
  const wires = useBoard((s) => s.circuit.wires);
  const selectedWireId = useBoard((s) => s.selectedWireId);
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

  /**
   * Picking a lead narrows the board to the two modules it joins, so the eye
   * goes straight to what is connected to what.
   */
  const focus = useMemo(() => wireFocus(wires, selectedWireId), [wires, selectedWireId]);

  /** Rubber band in board coordinates while a marquee drag is in progress. */
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** Holding space hands the left button back to panning. */
  const [panMode, setPanMode] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);
  /** Once the user pans or zooms, stop re-fitting the view out from under them. */
  const touched = useRef(false);
  const getScale = useCallback(() => zoomRef.current?.instance.transformState.scale ?? 1, []);

  /**
   * Strip the costly SVG filters while the view is moving (see globals.css).
   * Set on the element rather than through state so a gesture never re-renders
   * the board, and restored after a beat so wheel steps don't flicker them.
   */
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setMoving = useCallback((moving: boolean) => {
    clearTimeout(settle.current);
    if (moving) hostRef.current?.classList.add('board-moving');
    else settle.current = setTimeout(() => hostRef.current?.classList.remove('board-moving'), 200);
  }, []);
  useEffect(() => () => clearTimeout(settle.current), []);

  /**
   * Rule the bench under the board. The ruling is painted on a fixed sheet the
   * size of the viewport and simply re-offset as the board moves, so it costs
   * nothing to pan forever: there is no edge to reach in any direction.
   */
  const paintGrid = useCallback((scale: number, x: number, y: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    const minor = GRID_MINOR * scale;
    const major = GRID_MAJOR * scale;
    // Board (0,0) in viewport pixels: where the ruling is pinned.
    const ox = x + CANVAS_PAD * scale;
    const oy = y + CANVAS_PAD * scale;
    // Below a few pixels the fine ruling turns into noise, so it drops out
    // and only the heavy lines survive, the way a drawing sheet reads.
    const coarse = minor < 7;
    grid.classList.toggle('grid-coarse', coarse);
    grid.style.backgroundSize = coarse
      ? major + 'px ' + major + 'px, ' + major + 'px ' + major + 'px'
      : major + 'px ' + major + 'px, ' + major + 'px ' + major + 'px, ' + minor + 'px ' + minor + 'px, ' + minor + 'px ' + minor + 'px';
    grid.style.backgroundPosition = ox + 'px ' + oy + 'px';
  }, []);

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
    // The content starts one pad above and left of the plate's origin, so the
    // framing offset is measured from there rather than from board (0,0).
    const px = (host.clientWidth - w * scale) / 2 - (x0 + CANVAS_PAD) * scale;
    const py = (host.clientHeight - h * scale) / 2 - (y0 + CANVAS_PAD) * scale;
    zoomRef.current?.setTransform(px, py, scale, 0);
    paintGrid(scale, px, py);
  }, [paintGrid]);

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
      <div ref={hostRef} className="board-grid relative h-full w-full overflow-hidden">
        <div ref={gridRef} className="canvas-grid pointer-events-none absolute inset-0" />
        <TransformWrapper
          ref={zoomRef}
          minScale={0.04}
          maxScale={3}
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
            setMoving(true);
          }}
          onPanningStop={() => setMoving(false)}
          onZoomStart={() => {
            touched.current = true;
            setMoving(true);
          }}
          onZoomStop={() => setMoving(false)}
          onPinchingStart={() => {
            touched.current = true;
            setMoving(true);
          }}
          onPinchingStop={() => setMoving(false)}
          onTransformed={(_ref, state) => paintGrid(state.scale, state.positionX, state.positionY)}
        >
          <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-auto !h-auto">
            {/*
              Nothing bounds the workspace. The box below only sets how much of
              it answers to a click on empty bench; overflow stays visible, so a
              module or lead dragged past that box still draws, and panning goes
              on as far as anyone cares to drag.
            */}
            <div className="shrink-0" style={{ width: CANVAS_W, height: CANVAS_H }}>
              <svg
                ref={svgRef}
                width={CANVAS_W}
                height={CANVAS_H}
                viewBox={-CANVAS_PAD + ' ' + -CANVAS_PAD + ' ' + CANVAS_W + ' ' + CANVAS_H}
                className="max-w-none shrink-0"
                onPointerMove={onPointerMove}
                onPointerDown={onBackgroundDown}
                style={{ width: CANVAS_W, height: CANVAS_H, overflow: 'visible', cursor: panMode ? 'grab' : 'default' }}
              >
                <BoardDefs />

                <BoardPlate />
                {modules.map((m) => (
                  <ModuleView key={m.id} m={m} focus={focus} />
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
            </div>
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
