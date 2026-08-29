import { useEffect, useRef, useState } from 'react';

export interface RevealSegment {
  text: string;
  /** Tailwind text colour when filled */
  fill?: string;
  /** Tailwind text colour before the fill reaches it */
  faint?: string;
  /** start this segment on a new paragraph line */
  break?: boolean;
}

/**
 * Scroll-linked text fill: the copy sits in a faint tint and
 * fills word by word — with a soft edge — as the block travels up through
 * the viewport. One continuous progress across all segments, so a block
 * with several paragraphs reads as a single animation. No library;
 * reduced-motion shows it filled.
 */
export function ScrollReveal({ segments, className = '' }: { segments: RevealSegment[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const words = segments.flatMap((seg, si) =>
    seg.text.split(' ').map((w, wi) => ({ w, seg, first: wi === 0 && si > 0 })),
  );

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setProgress(1);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // starts filling when the top enters the lower 80% of the screen;
      // complete while the block is still fully on screen (bottom at 55%)
      const start = vh * 0.8;
      const end = vh * 0.55;
      const p = (start - r.top) / (r.height + (start - end));
      setProgress(Math.min(1, Math.max(0, p)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const filled = progress * words.length;
  return (
    <div ref={ref} className={className}>
      {words.map(({ w, seg, first }, i) => {
        const t = Math.min(1, Math.max(0, filled - i));
        const fill = seg.fill ?? 'text-ink';
        const faint = seg.faint ?? 'text-ink/15';
        return (
          <span key={i}>
            {first && seg.break && <span className="block h-[1em]" />}
            {/* the word exists once in the DOM (so copy/select is clean); the fill is a ::before overlay */}
            <span className={`reveal-word ${faint} ${fill.replace('text-', 'reveal-')}`} data-w={w + ' '} style={{ ['--fill' as string]: `${t * 100}%` }}>
              {w}{' '}
            </span>
          </span>
        );
      })}
    </div>
  );
}
