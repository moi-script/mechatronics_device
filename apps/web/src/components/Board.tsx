'use client';

import { useCallback, useEffect, useRef } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Maximize2, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useBoard } from '@/store/useBoard';
import { BOARD_H, BOARD_W } from '@/lib/geometry';
import { ModuleView } from './ModuleView';
import { Wires } from './Wires';
import { ScaleContext } from './ScaleContext';
import { BoardDefs, BoardPlate } from './BoardPlate';

export function Board() {
  const modules = useBoard((s) => s.circuit.modules);
  const setCursor = useBoard((s) => s.setCursor);
  const cancelWire = useBoard((s) => s.cancelWire);
  const selectWire = useBoard((s) => s.selectWire);
  const deleteWire = useBoard((s) => s.deleteWire);
  const undo = useBoard((s) => s.undo);
  const redo = useBoard((s) => s.redo);
  const canUndo = useBoard((s) => s.past.length > 0);
  const canRedo = useBoard((s) => s.future.length > 0);

  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);
  /** Once the user pans or zooms, stop re-fitting the view out from under them. */
  const touched = useRef(false);
  const getScale = useCallback(() => zoomRef.current?.instance.transformState.scale ?? 1, []);

  /** Scale the whole bench to whatever room the viewport gives us. */
  const fit = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const scale = Math.min(1.1, Math.max(0.18, Math.min(host.clientWidth / (BOARD_W + 48), host.clientHeight / (BOARD_H + 48))));
    zoomRef.current?.setTransform(
      (host.clientWidth - BOARD_W * scale) / 2,
      (host.clientHeight - BOARD_H * scale) / 2,
      scale,
      0,
    );
  }, []);

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

  // Screen pixels -> board units, so the trailing lead follows the cursor exactly.
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!useBoard.getState().pending) return;
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(ctm.inverse());
      setCursor(p.x, p.y);
    },
    [setCursor],
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
          panning={{ excluded: ['no-pan'], velocityDisabled: true }}
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
              style={{ width: BOARD_W, height: BOARD_H }}
              onPointerMove={onPointerMove}
              onPointerDown={() => {
                cancelWire();
                selectWire(null);
              }}
            >
              <BoardDefs />

              <BoardPlate />
              {modules.map((m) => (
                <ModuleView key={m.id} m={m} />
              ))}
              <Wires />
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
