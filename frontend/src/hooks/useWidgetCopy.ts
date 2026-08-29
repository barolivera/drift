import { useEffect } from 'react';

/**
 * Trims the payment widget's copy to what a guest needs to pay.
 *
 * The widget has no props for its texts, so — like the stepper — we adjust
 * them in the DOM after each render:
 *   · the "Order #…" line in the payment box goes (debug data; it still
 *     appears in the widget's own expired-order help, which we leave alone)
 *   · the bilingual "scan to copy — not a payable QR" caption becomes one
 *     line in the interface language
 */
const CAPTION_MARK = /não é um qr|no es un qr|not a payable qr/i;
const CAPTION_BY_LANG: [RegExp, string][] = [
  [/pix/i, 'Scan to copy the PIX key'],
  [/alias/i, 'Scan to copy the alias'],
];

export function useWidgetCopy(host: HTMLElement | null) {
  useEffect(() => {
    if (!host) return;
    const apply = () => {
      host.querySelectorAll<HTMLElement>('span').forEach((el) => {
        if (el.childElementCount === 0 && el.textContent?.trim().startsWith('Order #')) el.style.display = 'none';
      });
      host.querySelectorAll<HTMLElement>('p').forEach((el) => {
        const strong = el.querySelector('strong');
        if (!strong || !CAPTION_MARK.test(strong.textContent ?? '')) return;
        const text = el.textContent ?? '';
        const line = CAPTION_BY_LANG.find(([re]) => re.test(text))?.[1] ?? 'Scan to copy the payment key';
        el.textContent = line;
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [host]);
}
