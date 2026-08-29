import type { Inclusion } from '@/lib/inclusions';
import { Patch } from '@/components/Marks';

/**
 * Two-column grid of inclusions: line icon, uppercase label, one line.
 * `plain` (Home): freestanding icon + display label.
 * `patch` (edition page): shield-framed icon + small label.
 * These are things you get, not a schedule — no hours anywhere.
 */
export function Inclusions({ items, variant = 'patch', className = '' }: { items: Inclusion[]; variant?: 'patch' | 'plain'; className?: string }) {
  if (variant === 'plain') {
    return (
      <ul className={`grid gap-x-16 gap-y-12 md:grid-cols-2 ${className}`}>
        {items.map(({ label, detail, Icon }) => (
          <li key={label + detail} className="flex items-start gap-5">
            <Icon className="mt-1 h-14 w-14 shrink-0 text-ink" title={label} />
            <div>
              <h3 className="display text-[1.75rem] uppercase leading-none text-ink">{label}</h3>
              <p className="mt-2 text-base leading-snug text-ink/80">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={`grid gap-x-14 gap-y-14 sm:grid-cols-2 ${className}`}>
      {items.map(({ label, detail, Icon }) => (
        <li key={label + detail} className="flex items-start gap-6">
          <Patch Icon={Icon} title={label} className="h-24 shrink-0 text-forest" />
          <div>
            <h3 className="label pt-1 text-[0.875rem] text-ink">{label}</h3>
            <p className="mt-2 text-base leading-snug text-mute">{detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
