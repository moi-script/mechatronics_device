/**
 * The bench's mark: a patch lead hanging between two terminals. Kept in step
 * with app/icon.svg, which is the same drawing at favicon size.
 */
export function BrandMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Mechatronic">
      <rect width="32" height="32" rx="7" fill="#101826" />
      <rect x={2.5} y={2.5} width={27} height={27} rx={5} fill="none" stroke="#33415a" strokeWidth={1} />
      <path d="M 10.5 12 C 10.5 27, 21.5 27, 21.5 12" fill="none" stroke="#f0a323" strokeWidth={3.4} strokeLinecap="round" />
      <path
        d="M 10.5 11.3 C 10.5 26.3, 21.5 26.3, 21.5 11.3"
        fill="none"
        stroke="#ffd27a"
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.75}
      />
      <circle cx={10.5} cy={11} r={4.4} fill="#e2e8f0" />
      <circle cx={10.5} cy={11} r={1.9} fill="#101826" />
      <circle cx={21.5} cy={11} r={4.4} fill="#e2e8f0" />
      <circle cx={21.5} cy={11} r={1.9} fill="#101826" />
    </svg>
  );
}
