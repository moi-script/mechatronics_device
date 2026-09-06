'use client';

import type { ModuleType } from '@mech/sim';

/**
 * Schematic symbols for the bench stock. They are drawn in one 64x48 frame in
 * currentColor, so the parts bin can show what a component *is* at a glance
 * the way a symbol palette does, rather than listing its name.
 */
const SYMBOLS: Record<ModuleType, React.ReactNode> = {
  BREAKER: (
    <>
      <path d="M6 24h10M48 24h10" />
      <path d="M16 24 44 12" />
      <circle cx="16" cy="24" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="48" cy="24" r="2.5" fill="currentColor" stroke="none" />
      <path d="M30 8v-4M30 34v4" strokeDasharray="3 3" />
      <path d="M24 38h12" />
    </>
  ),
  SUPPLY: (
    <>
      <path d="M6 24h12M46 24h12" />
      <path d="M18 12v24M28 17v14M36 12v24M46 17v14" />
    </>
  ),
  PUSHBTN: (
    <>
      <path d="M6 32h12M46 32h12" />
      <circle cx="18" cy="32" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="46" cy="32" r="2.5" fill="currentColor" stroke="none" />
      <path d="M16 26h32" />
      <path d="M32 26V12" />
      <path d="M24 8h16v4H24z" />
    </>
  ),
  TOGGLE: (
    <>
      <path d="M6 30h12M46 30h12" />
      <circle cx="18" cy="30" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="46" cy="30" r="2.5" fill="currentColor" stroke="none" />
      <path d="M18 30 44 16" />
      <path d="M44 12v8" strokeDasharray="2 3" />
    </>
  ),
  LAMP: (
    <>
      <path d="M4 24h12M48 24h12" />
      <circle cx="32" cy="24" r="14" />
      <path d="M22 14 42 34M42 14 22 34" />
    </>
  ),
  RELAY: (
    <>
      <rect x="8" y="14" width="20" height="16" rx="1.5" />
      <path d="M8 22H3M28 22h4" />
      {/* One NO contact, drawn off the coil by the usual dashed link. */}
      <path d="M36 32h6M56 32h5" />
      <circle cx="42" cy="32" r="2" fill="currentColor" stroke="none" />
      <circle cx="56" cy="32" r="2" fill="currentColor" stroke="none" />
      <path d="M42 32 57 21" />
      <path d="M32 22h8" strokeDasharray="3 3" />
    </>
  ),
  BIGRELAY: (
    <>
      <rect x="4" y="16" width="18" height="16" rx="1.5" />
      <path d="M4 24H1M22 24h4" />
      <path d="M26 24h8" strokeDasharray="3 3" />
      {[8, 20, 32, 44].map((y) => (
        <g key={y}>
          <path d={'M36 ' + y + 'h4M54 ' + y + 'h6'} />
          <circle cx="40" cy={y} r="1.6" fill="currentColor" stroke="none" />
          <path d={'M40 ' + y + 'L55 ' + (y - 7)} />
        </g>
      ))}
    </>
  ),
  SOLENOID: (
    <>
      <rect x="8" y="14" width="22" height="20" rx="1.5" />
      <path d="M8 34 30 14" />
      <path d="M30 24h8" />
      <rect x="38" y="14" width="18" height="20" rx="1.5" />
      <path d="M42 18v12M47 18v12M52 18v12" />
    </>
  ),
  CYLINDER: (
    <>
      <rect x="6" y="14" width="34" height="20" rx="1.5" />
      <path d="M24 14v20" />
      <path d="M24 24h22" />
      <rect x="46" y="19" width="12" height="10" rx="1" />
    </>
  ),
  TIMER: (
    <>
      <rect x="6" y="14" width="20" height="16" rx="1.5" />
      <path d="M6 22H2M26 22h4" />
      <circle cx="46" cy="24" r="13" />
      <path d="M46 16v8l6 4" />
    </>
  ),
};

export function PartSymbol({ type, className }: { type: ModuleType; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {SYMBOLS[type]}
    </svg>
  );
}
