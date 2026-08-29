import { useLocation } from 'react-router-dom';
import { FAQ_ITEMS, type FaqItem } from '@/lib/faq';

/**
 * Accordion, Lunte-style: every question is its own paper card, stacked with a
 * small gap; a thin +/− on the left, the question set large and regular, and
 * the answer indented under it in grey. An item whose id matches the URL hash
 * opens by default.
 */
export function Faq({ items = FAQ_ITEMS, className = '' }: { items?: FaqItem[]; className?: string }) {
  const { hash } = useLocation();
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {items.map((it) => (
        <details key={it.q} id={it.id} open={Boolean(it.id) && hash === `#${it.id}`} className="group card-paper scroll-mt-28 shadow-none">
          <summary className="flex cursor-pointer items-center gap-6 px-6 py-7 sm:gap-10 sm:px-10 sm:py-9">
            <span aria-hidden className="relative h-5 w-5 shrink-0 text-mute">
              <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current transition-transform duration-200 group-open:scale-y-0" />
            </span>
            <span className="text-[clamp(1.125rem,1.9vw,1.75rem)] font-normal leading-snug text-ink">{it.q}</span>
          </summary>
          <div className="px-6 pb-8 pl-[calc(1.5rem+1.25rem+1.5rem)] text-base leading-relaxed text-mute sm:pb-10 sm:pl-[28%] sm:pr-12">
            {it.a}
          </div>
        </details>
      ))}
    </div>
  );
}
