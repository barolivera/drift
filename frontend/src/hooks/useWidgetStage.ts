import { useEffect } from 'react';

/**
 * Reads the payment widget's progress from its DOM.
 *
 * The widget only reports the edges of an order (placed, completed,
 * cancelled) through props; the transition that matters most to us —
 * "matched, now pay" — never fires a callback. Its stepper does render it,
 * though: each `.p2p-stepper-cell` starts with a disc that shows ✓ once the
 * step is done. Counting the ✓ gives the step index:
 *
 *   0 matching · 1 pay · 2 verifying · 3 complete
 *
 * `onIndex` fires with -1 while no stepper is rendered (the widget is still on
 * its own checkout screen). Works while the host is `display: none`.
 */
export function useWidgetStage(host: HTMLElement | null, onIndex: (index: number) => void) {
  useEffect(() => {
    if (!host) return;
    let last = Number.NaN;
    const read = () => {
      const stepper = host.querySelector('.p2p-stepper');
      let index = -1;
      if (stepper) {
        index = 0;
        stepper.querySelectorAll('.p2p-stepper-cell > div:first-child').forEach((disc) => {
          if (disc.textContent?.trim() === '✓') index += 1;
        });
      }
      if (index !== last) {
        last = index;
        onIndex(index);
      }
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [host, onIndex]);
}
