import { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Ticket } from '@phosphor-icons/react';

/**
 * Trims the payment widget's copy to what a guest needs to pay.
 *
 * The widget has no props for its texts, so — like the stepper — we adjust
 * them in the DOM after each render. Text is changed on the text nodes
 * themselves so the widget's own updates (countdown, "Confirming…") keep
 * working:
 *   · the order summary's emoji becomes a Phosphor ticket
 *   · the "Order #…" line in the payment box goes (debug data; it still
 *     appears in the widget's own expired-order help, which we leave alone)
 *   · the bilingual "scan to copy — not a payable QR" caption becomes one
 *     line in the interface language
 *   · on the pay screen the amount is stated once (the headline) and the
 *     trip once (Drift's own strip): "for <trip>", the "Pay via … and
 *     confirm" pill and the countdown sentence go, step 1 and the confirm
 *     button stop repeating the amount
 */
const CAPTION_MARK = /não é um qr|no es un qr|not a payable qr/i;
const CAPTION_BY_LANG: [RegExp, string][] = [
  [/pix/i, 'Scan to copy the PIX key'],
  [/alias/i, 'Scan to copy the alias'],
];

const TICKET_EMOJI = /^\u{1F39F}️?$/u;
const TICKET_SVG = renderToStaticMarkup(<Ticket weight="fill" size={24} aria-hidden />);

/** Direct text-node rewrite: keeps React's node so its later updates still land. */
function rewrite(el: HTMLElement, re: RegExp, text: string) {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && re.test(node.nodeValue ?? '')) node.nodeValue = text;
  }
}
const hide = (el: HTMLElement) => {
  el.style.display = 'none';
};

export function useWidgetCopy(host: HTMLElement | null) {
  useEffect(() => {
    if (!host) return;
    const apply = () => {
      host.querySelectorAll<HTMLElement>('div').forEach((el) => {
        if (el.childElementCount === 0 && TICKET_EMOJI.test(el.textContent?.trim() ?? '')) {
          el.innerHTML = TICKET_SVG;
          el.style.color = 'var(--color-coral)';
        }
      });
      host.querySelectorAll<HTMLElement>('span').forEach((el) => {
        const text = el.textContent?.trim() ?? '';
        if (el.childElementCount === 0 && text.startsWith('Order #')) hide(el);
        if (/^Pay via .+ and confirm$/.test(text)) hide(el);
      });
      host.querySelectorAll<HTMLElement>('p').forEach((el) => {
        const text = el.textContent?.trim() ?? '';
        const strong = el.querySelector('strong');
        if (strong && CAPTION_MARK.test(strong.textContent ?? '')) {
          const line = CAPTION_BY_LANG.find(([re]) => re.test(text))?.[1] ?? 'Scan to copy the payment key';
          el.textContent = line;
          return;
        }
        if (text.startsWith('for ') && el.previousElementSibling?.tagName === 'H1') hide(el);
        if (/ or the order auto-cancels\.$/.test(text)) hide(el);
        rewrite(el, /^Send [A-Z]{3} [\d.,]+$/, 'Send the payment');
      });
      host.querySelectorAll<HTMLElement>('button').forEach((el) => {
        rewrite(el, /^I've sent [A-Z]{3} [\d.,]+$/, "I've sent the payment");
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [host]);
}
