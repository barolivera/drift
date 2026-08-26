import type { ReactNode } from 'react';

export const CONTRACT_URL = 'https://sepolia.basescan.org/address/0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F';

export interface FaqItem {
  id?: string;
  q: string;
  a: ReactNode;
}

/** Shared between the Home and every edition page. */
export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'paying',
    q: 'How does paying work?',
    a: (
      <div className="space-y-3">
        <p>
          You never touch crypto unless you want to. The price is in USDC so it's the same for everyone; you pay it
          with money you already have.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-ink">Pay in your local currency.</strong> A regular bank transfer from
            your phone — no wallet, no exchange. Brazilian reais via PIX today; more currencies as P2P.me opens merchant
            circles.
          </li>
          <li>
            <strong className="font-semibold text-ink">A P2P merchant converts it.</strong> A verified P2P.me merchant
            receives your transfer and releases the equivalent USDC. It settles on Base within minutes.
          </li>
          <li>
            <strong className="font-semibold text-ink">Drift receives it on-chain.</strong> The USDC lands in Drift's
            integrator contract and goes straight to the treasury. Your seat is confirmed the moment the order completes.
          </li>
        </ol>
        <p className="flex flex-wrap items-center gap-2 pt-1">
          <span className="chip chip-forest">0x7e1b…bb3F</span>
          <span className="chip chip-ghost">Base Sepolia</span>
          <span className="chip chip-ghost">Verified source</span>
          <a href={CONTRACT_URL} target="_blank" rel="noreferrer" className="pixel underline underline-offset-4">
            Read the contract on Basescan ↗
          </a>
        </p>
      </div>
    ),
  },
  {
    q: 'What exactly is included?',
    a: 'Fourteen nights in the house (room of your choice), breakfast every day and dinner at the long table, coached surf sessions split by level with video review, boards and wetsuits, morning yoga, the work room, the evening programme and demo night, airport transfers on arrival and departure day, and one off-grid day. Flights, lunches, travel insurance and visas are on you.',
  },
  {
    q: "I've never surfed. Is that a problem?",
    a: 'No. Sessions are split by level and the first three days exist for exactly this. Itamambuca in January is the friendlier water; Praia do Rosa in autumn is better if you already have a few weeks under you.',
  },
  {
    q: 'Can I cancel?',
    a: "Before your payment completes, yes, at no cost — the seat is released automatically if the order expires or you cancel it. After it completes, write to us: we'll refund if the seat can be filled, and we'll always tell you where you stand. There is no automatic refund path on-chain yet, so please don't pay until you're sure.",
  },
  {
    q: 'What level of English do I need?',
    a: 'Enough to work and eat with fifteen people from different countries. Workshops and demo night are in English; the coaches speak Portuguese and English. If you can read this page comfortably, you\'re fine.',
  },
  {
    q: 'Is the wifi actually good?',
    a: 'Fibre to the house, a dedicated work room with monitors and two call booths, plus a 4G backup. Ubatuba and Praia do Rosa both have real fibre now — we tested it, and we schedule deep work in the window when nobody is on calls.',
  },
];
