import { useLocation } from 'react-router-dom';
import { FAQ_ITEMS, type FaqItem } from '@/lib/faq';

/** Accordion in one surface card. An item whose id matches the URL hash opens by default. */
export function Faq({ items = FAQ_ITEMS, className = '' }: { items?: FaqItem[]; className?: string }) {
  const { hash } = useLocation();
  return (
    <div className={`card divide-y divide-line px-6 sm:px-8 ${className}`}>
      {items.map((it) => (
        <details key={it.q} id={it.id} open={Boolean(it.id) && hash === `#${it.id}`} className="group scroll-mt-28 py-5">
          <summary className="flex cursor-pointer items-start justify-between gap-6 text-lg font-bold tracking-tight text-ink">
            <span>{it.q}</span>
            <span aria-hidden className="mt-1 shrink-0 text-coral transition-transform duration-300 group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="mt-3 max-w-prose text-ink/80">{it.a}</div>
        </details>
      ))}
    </div>
  );
}
