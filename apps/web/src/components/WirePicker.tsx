'use client';

import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import type { WireColor } from '@mech/sim';
import { useBoard } from '@/store/useBoard';
import { useWireColors } from '@/store/useTheme';
import { Popover } from './Popover';

/**
 * The lead rack, sorted the way a bench drawer is: the two supply colours, the
 * signal set, then the spares. Every colour in WIRE_COLORS lives in exactly one
 * of these rows, so adding a colour means adding it here too.
 */
const RACK: { name: string; note: string; colors: WireColor[] }[] = [
  { name: 'Supply', note: 'live and return', colors: ['red', 'black'] },
  { name: 'Signal', note: 'control and interlocks', colors: ['blue', 'green', 'yellow', 'white'] },
  { name: 'Spare', note: 'anything else', colors: ['orange', 'brown', 'violet', 'grey', 'pink', 'cyan'] },
];

export function WirePicker() {
  const wireColor = useBoard((s) => s.wireColor);
  const setWireColor = useBoard((s) => s.setWireColor);
  const WIRE_HEX = useWireColors();

  const swatch = (c: WireColor, size: string) => (
    <span
      className={clsx('inline-block rounded-full border border-carbon-900/40', size)}
      style={{ backgroundColor: WIRE_HEX[c] }}
    />
  );

  return (
    <Popover
      title={'Lead colour: ' + wireColor}
      buttonClass="gap-2"
      panelClass="w-[248px]"
      trigger={
        <>
          <span className="engraved hidden text-[10px] font-semibold text-carbon-600 sm:inline">Lead</span>
          {swatch(wireColor, 'h-4 w-4')}
          <span className="capitalize">{wireColor}</span>
          <ChevronDown className="h-3 w-3 text-carbon-600" />
        </>
      }
      panel={(close) => (
        <div className="flex flex-col gap-2.5">
          {RACK.map((row) => (
            <div key={row.name}>
              <div className="mb-1 flex items-baseline gap-1.5">
                <span className="engraved text-[10px] font-bold uppercase tracking-wide text-carbon-800">{row.name}</span>
                <span className="text-[9px] text-carbon-600">{row.note}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={c}
                    aria-pressed={wireColor === c}
                    onClick={() => {
                      setWireColor(c);
                      close();
                    }}
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 transition',
                      wireColor === c ? 'border-carbon-900' : 'border-steel-400 hover:border-carbon-600',
                    )}
                    style={{ backgroundColor: WIRE_HEX[c] }}
                  >
                    {wireColor === c && <Check className="h-4 w-4 text-white mix-blend-difference" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="border-t border-steel-400 pt-1.5 text-[10px] leading-snug text-carbon-600">
            The colour applies to the next lead you run.
          </p>
        </div>
      )}
    />
  );
}
