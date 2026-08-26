import type { Inclusion } from '@/lib/inclusions';

/**
 * Two-column grid of inclusions: thin line icon, uppercase label, one line.
 * These are things you get, not a schedule — no hours anywhere.
 */
export function Inclusions({ items, className = '' }: { items: Inclusion[]; className?: string }) {
  return (
    <ul className={`grid gap-x-10 gap-y-8 sm:grid-cols-2 ${className}`}>
      {items.map(({ label, detail, Icon }) => (
        <li key={label + detail} className="flex items-start gap-4">
          <Icon className="mt-0.5 h-12 w-12 shrink-0 text-ink" title={label} />
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-[0.06em] text-ink">{label}</h3>
            <p className="mt-1 text-sm leading-snug text-mute">{detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
