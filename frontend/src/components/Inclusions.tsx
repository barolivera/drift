import type { Inclusion } from '@/lib/inclusions';
import { Patch } from '@/components/Marks';

/**
 * Two-column grid of inclusions: icon, label, one line.
 * `list` (Home): coral artwork in a 56px box, text-face title, one line.
 * `plain`: freestanding line icon + display label.
 * `patch` (edition page): shield-framed icon + small label.
 * These are things you get, not a schedule — no hours anywhere.
 */
export function Inclusions({
  items,
  variant = 'patch',
  className = '',
}: {
  items: Inclusion[];
  variant?: 'patch' | 'plain' | 'list';
  className?: string;
}) {
  if (variant === 'list') {
    return (
      <ul className={`grid gap-x-16 gap-y-12 md:grid-cols-2 ${className}`}>
        {items.map(({ label, detail, Icon, art }) => (
          <li key={label + detail} className="flex items-start gap-5">
            {/* 56px box, nudged 4px down to sit on the title's baseline */}
            <span className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center">
              {art ? (
                <img src={art.src} alt="" width={art.w} height={art.h} style={{ width: art.w, height: art.h }} />
              ) : (
                <Icon className="h-14 w-14 text-coral" title={label} />
              )}
            </span>
            <div className="min-w-0">
              <h3 className="text-[1.75rem] font-normal leading-7 text-ink">{label}</h3>
              <p className="mt-2 text-base leading-[22px] text-ink/80">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    );
  }
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
