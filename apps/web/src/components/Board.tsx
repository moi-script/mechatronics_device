'use client';

import { useCallback, useEffect, useRef } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useBoard } from '@/store/useBoard';
import { BOARD_H, BOARD_W } from '@/lib/geometry';
import { ModuleView } from './ModuleView';
import { Wires } from './Wires';
import { ScaleContext } from './ScaleContext';

const TICK_MS = 50;

export function Board() {
  const modules = useBoard((s) => s.circuit.modules);
  const setCursor = useBoard((s) => s.setCursor);
  const cancelWire = useBoard((s) => s.cancelWire);
  const selectWire = useBoard((s) => s.selectWire);
  const deleteWire = useBoard((s) => s.deleteWire);
  const tick = useBoard((s) => s.tick);

  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);
  const getScale = useCallback(() => zoomRef.current?.instance.transformState.scale ?? 1, []);

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

  return (
    <ScaleContext.Provider value={getScale}>
      <TransformWrapper
        ref={zoomRef}
        minScale={0.25}
        maxScale={2.5}
        initialScale={0.62}
        limitToBounds={false}
        centerOnInit
        doubleClick={{ disabled: true }}
        panning={{ excluded: ['no-pan'], velocityDisabled: true }}
        wheel={{ step: 0.08 }}
      >
        <TransformComponent
          wrapperClass="!w-full !h-full board-grid"
          contentClass="!w-auto !h-auto"
        >
          <svg
            ref={svgRef}
            width={BOARD_W}
            height={BOARD_H}
            viewBox={'0 0 ' + BOARD_W + ' ' + BOARD_H}
            className="max-w-none"
            style={{ width: BOARD_W, height: BOARD_H }}
            onPointerMove={onPointerMove}
            onPointerDown={() => {
              cancelWire();
              selectWire(null);
            }}
          >
            <defs>
              <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#141d33" />
              </linearGradient>
              <radialGradient id="brass" cx="35%" cy="30%">
                <stop offset="0%" stopColor="#f5deb3" />
                <stop offset="60%" stopColor="#d9b06a" />
                <stop offset="100%" stopColor="#8a6a35" />
              </radialGradient>
              <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="7" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width={BOARD_W} height={BOARD_H} rx={20} fill="#0e1526" stroke="#1e293b" strokeWidth={2} />
            {modules.map((m) => (
              <ModuleView key={m.id} m={m} />
            ))}
            <Wires />
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </ScaleContext.Provider>
  );
}
