/**
 * Ordered-dither dissolve for the edition cards.
 *
 * A 4×4 Bayer matrix tiled at 4px per cell gives 17 masks, from "every cell
 * kept" (the dithered layer fully visible) to "no cell kept" (fully
 * transparent, the real photo shows). Stepping through them one at a time is
 * what makes the photo look like it de-dithers into view.
 */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const CELL = 4;
export const DITHER_TILE = BAYER.length * CELL; // 16px

function maskAt(level: number): string {
  if (level <= 0) return 'none';
  const rects = BAYER.flatMap((row, y) =>
    row.map((v, x) => (v >= level ? `<rect x='${x * CELL}' y='${y * CELL}' width='${CELL}' height='${CELL}'/>` : '')),
  ).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${DITHER_TILE}' height='${DITHER_TILE}' fill='%23fff'>${rects}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
}

/** Index 0 = layer fully visible … index 16 = layer gone. */
export const DITHER_MASKS = Array.from({ length: 17 }, (_, i) => maskAt(i));

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Dissolve the layer away (`reveal = true`) or bring it back, one Bayer step
 * at a time. Uses the Web Animations API so entering and leaving each start a
 * fresh stepped animation from the current end state.
 */
export function ditherReveal(el: HTMLElement, reveal: boolean, durationMs = 520) {
  el.getAnimations().forEach((a) => a.cancel());
  if (reducedMotion()) {
    el.animate([{ opacity: reveal ? 1 : 0 }, { opacity: reveal ? 0 : 1 }], { duration: 250, fill: 'forwards' });
    return;
  }
  const masks = reveal ? DITHER_MASKS : [...DITHER_MASKS].reverse();
  // `easing` on the options would apply to the whole run (first frame held, then a
  // jump to the last); the step has to live on each keyframe so every level shows.
  el.animate(
    masks.map((maskImage) => ({ maskImage, webkitMaskImage: maskImage, easing: 'steps(1, end)' }) as Keyframe),
    { duration: durationMs, fill: 'forwards' },
  );
}
