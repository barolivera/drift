import { createElement, useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';

/**
 * Reveals its element once it scrolls into view: a small rise + fade, staggered
 * across children when `group` is set (see .rise/.rise-group in index.css).
 * One shared IntersectionObserver; each element animates once and is released.
 * prefers-reduced-motion turns the whole thing off in CSS.
 */
let io: IntersectionObserver | null = null;
function watch(el: Element) {
  io ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io!.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
  );
  io.observe(el);
}

export function Reveal({
  as = 'div',
  group = false,
  delay = 0,
  className = '',
  children,
}: {
  /** Element to render (h2, div, section…). */
  as?: ElementType;
  /** Stagger the element's direct children instead of rising as one block. */
  group?: boolean;
  /** Extra delay in ms, e.g. for a block that follows a title. */
  delay?: number;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    watch(el);
    return () => io?.unobserve(el);
  }, []);
  const style = delay ? ({ '--rise-delay': `${delay}ms` } as CSSProperties) : undefined;
  return createElement(as, { ref, style, className: `${group ? 'rise-group' : 'rise'} ${className}`.trim() }, children);
}
