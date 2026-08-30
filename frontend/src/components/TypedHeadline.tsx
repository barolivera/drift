import { useEffect, useState } from 'react';

interface TypedHeadlineProps {
  lines: string[];
  /** ms before the first character appears */
  startDelay?: number;
  /** ms per character */
  speed?: number;
  /** extra pause at a line break, ms */
  linePause?: number;
  className?: string;
  onDone?: () => void;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Types the headline out one character at a time, line by line, with a block
 * caret. Every character is in the DOM from the start (the untyped ones are
 * just invisible) so nothing reflows, and the whole text is exposed to
 * assistive tech through aria-label. Reduced motion → shown at once.
 */
export function TypedHeadline({ lines, startDelay = 0, speed = 40, linePause = 300, className = '', onDone }: TypedHeadlineProps) {
  const total = lines.reduce((n, l) => n + l.length, 0);
  const [shown, setShown] = useState(() => (reducedMotion() ? total : 0));
  const done = shown >= total;

  useEffect(() => {
    if (done) {
      onDone?.();
      return;
    }
    // Pause a little longer when the previous character closed a line.
    let acc = 0;
    let atLineEnd = false;
    for (const l of lines) {
      acc += l.length;
      if (acc === shown) atLineEnd = true;
    }
    const delay = shown === 0 ? startDelay : atLineEnd ? linePause : speed;
    const t = setTimeout(() => setShown((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [shown, done, lines, startDelay, speed, linePause, onDone]);

  let offset = 0;
  return (
    <h1 className={className} aria-label={lines.join(' ')}>
      {lines.map((line, i) => {
        const start = offset;
        offset += line.length;
        const visible = Math.max(0, Math.min(line.length, shown - start));
        const caretHere = !done && shown >= start && shown <= start + line.length && (shown < start + line.length || i === lines.length - 1);
        return (
          <span key={i} aria-hidden className="block whitespace-nowrap">
            <span>{line.slice(0, visible)}</span>
            {caretHere && <span className="hero-caret">▍</span>}
            <span className="invisible">{line.slice(visible)}</span>
          </span>
        );
      })}
    </h1>
  );
}
