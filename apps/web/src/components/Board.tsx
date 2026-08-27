'use client';

import { useCallback, useEffect, useRef } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { useBoard } from '@/store/useBoard';
import { BOARD_H, BOARD_W } from '@/lib/geometry';
import { ModuleView } from './ModuleView';
import { Wires } from './Wires';
import { ScaleContext } from './ScaleContext';
import { BoardDefs, BoardPlate } from './BoardPlate';

const TICK_MS = 50;

export function Board() {
  const modules = useBoard((s) => s.circuit.modules);
  const setCursor = useBoard((s) => s.setCursor);
  const cancelWire = useBoard((s) => s.cancelWire);
  const selectWire = useBoard((s) => s.selectWire);
  const deleteWire = useBoard((s) => s.deleteWire);
  const tick = useBoard((s) => s.tick);

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
    const id = setInterval(() => tick(TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelWire();
        selectWire(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useBoard.getState().selectedWireId;
        if (id) deleteWire(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelWire, selectWire, deleteWire]);

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

  const zoomBtn =
    'flex h-9 w-9 items-center justify-center rounded-md border border-steel-400 bg-steel-50/95 text-carbon-600 shadow-sm transition hover:bg-white hover:text-carbon-900';

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

        <div className="absolute bottom-4 right-4 flex gap-1.5">
          <button type="button" title="Zoom out" className={zoomBtn} onClick={() => zoomRef.current?.zoomOut(0.2)}>
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" title="Zoom in" className={zoomBtn} onClick={() => zoomRef.current?.zoomIn(0.2)}>
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Fit the whole board"
            className={zoomBtn}
            onClick={() => {
              touched.current = false;
              fit();
            }}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </ScaleContext.Provider>
  );
}
