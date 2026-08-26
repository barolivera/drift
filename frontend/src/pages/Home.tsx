import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDateRange, formatUsdc, hasFoundingPrice, type ScheduleItem, type Trip } from '@/lib/api';
import { photos, src, srcSet, type Photo } from '@/lib/photos';

const CONTRACT_URL = 'https://sepolia.basescan.org/address/0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F';

/* Fallback if the API is unreachable — same content as the seed. */
const FALLBACK_SCHEDULE: ScheduleItem[] = [
  { time: '06:45', title: 'Dawn patrol', detail: 'Optional. The best window is before the wind comes up.' },
  { time: '08:30', title: 'Breakfast', detail: 'Together, at the house.' },
  { time: '09:15', title: 'Yoga & mobility', detail: '45 minutes. Your shoulders will need it by day four.' },
  { time: '10:00', title: 'Deep work', detail: 'Three hours, no meetings, no calls in shared space. The one rule of the house.', highlight: true },
  { time: '13:00', title: 'Lunch', detail: 'Then the afternoon is yours.' },
  { time: '16:00', title: 'Coached surf', detail: 'Split by level, video review twice a week.' },
  { time: '18:30', title: 'Programming', detail: 'A workshop, a guest talk, or an open hack session.' },
  { time: '20:00', title: 'Dinner', detail: 'One long table, everyone.' },
];

const EDITION_PHOTO: Record<string, Photo> = {
  itamambuca: photos.itamambuca,
  'praia-do-rosa': photos.praiaDoRosa,
};

export function Home() {
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    api<Trip[]>('/api/trips')
      .then(setTrips)
      .catch(() => setTrips([]));
  }, []);

  const schedule = trips?.[0]?.daily_schedule?.length ? trips[0].daily_schedule : FALLBACK_SCHEDULE;

  return (
    <div className="font-sans">
      <Hero />
      <Manifesto />
      <TheDay schedule={schedule} />
      <Editions trips={trips} />
      <WhoItsFor />
      <HowPayingWorks />
      <Faq />
      <FooterCta />
    </div>
  );
}

/* ───────────────────────── 1. HERO ───────────────────────── */
function Hero() {
  return (
    <section className="relative isolate min-h-[92svh] overflow-hidden bg-ink text-sand-50">
      <img
        src={src(photos.hero, 1600)}
        srcSet={srcSet(photos.hero)}
        sizes="100vw"
        alt={photos.hero.alt}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/10" />

      <div className="mx-auto flex min-h-[92svh] max-w-7xl flex-col justify-end px-5 pb-14 pt-24 sm:px-8 md:pb-20">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-sand-300">Drift · Brazil · 2027</p>
        <h1 className="max-w-[12ch] font-display text-display-2xl font-extrabold text-sand-50">
          Two weeks.
          <br />
          Sixteen people.
          <br />
          One beach.
        </h1>
        <p className="mt-8 max-w-xl text-lede text-sand-100/90">
          Surf residencies in Brazil for people who work remotely and build things. Pay in your currency — Drift
          settles in USDC.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="#editions"
            className="inline-flex items-center gap-2 rounded-full bg-sand-50 px-6 py-3 text-sm font-semibold text-ink transition hover:bg-coral hover:text-sand-50"
          >
            See the editions <span aria-hidden>↓</span>
          </a>
          <a href="#paying" className="text-sm font-medium text-sand-100/80 underline-offset-4 hover:underline">
            How paying works
          </a>
        </div>
        <Credit photo={photos.hero} className="absolute bottom-3 right-4 text-sand-100/50" />
      </div>
    </section>
  );
}

/* ───────────────────── 2. MANIFESTO (no photo) ───────────────────── */
function Manifesto() {
  return (
    <section className="bg-ocean-500 text-sand-50">
      <div className="mx-auto max-w-7xl px-5 py-section sm:px-8">
        <p className="font-display text-display-lg font-bold">
          This is not a surf camp with wifi. Sixteen people share a house for two weeks: mornings in the water, three
          protected hours of work in the middle of the day, and a demo night at the end.{' '}
          <span className="text-ink">You leave with something shipped and fifteen people who saw you build it.</span>
        </p>
      </div>
    </section>
  );
}

/* ───────────────────── 3. THE DAY (signature section, no photo) ───────────────────── */
function TheDay({ schedule }: { schedule: ScheduleItem[] }) {
  return (
    <section className="bg-sand-50">
      <div className="mx-auto max-w-7xl px-5 py-section sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
          <div className="md:sticky md:top-24 md:self-start">
            <h2 className="font-display text-display-xl font-extrabold text-ink">The day</h2>
            <p className="mt-4 max-w-xs text-lede text-ocean-800">The schedule is the product.</p>
            <p className="mt-6 max-w-xs text-sm text-ocean-700">
              Same rhythm for fourteen days. Surf when the ocean is best, work when your head is best, eat together.
            </p>
          </div>

          <ol className="relative">
            {schedule.map((slot, i) => {
              const hl = Boolean(slot.highlight);
              return (
                <li
                  key={slot.time}
                  className={`grid grid-cols-[4.5rem_1fr] gap-4 border-t border-sand-300 py-5 sm:grid-cols-[6rem_1fr] sm:gap-8 ${
                    hl ? 'relative -mx-4 rounded-2xl border-t-0 bg-ink px-4 py-7 text-sand-50 sm:-mx-6 sm:px-6' : ''
                  } ${i === schedule.length - 1 && !hl ? 'border-b' : ''}`}
                >
                  <span
                    className={`font-display text-display-md font-bold tabular-nums ${hl ? 'text-coral' : 'text-ocean-500'}`}
                  >
                    {slot.time}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className={`font-display text-display-md font-bold ${hl ? 'text-sand-50' : 'text-ink'}`}>
                        {slot.title}
                      </h3>
                      {hl && (
                        <span className="rounded-full bg-coral px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink">
                          The one rule
                        </span>
                      )}
                    </div>
                    <p className={`mt-1.5 max-w-prose ${hl ? 'text-lede text-sand-100/90' : 'text-ocean-700'}`}>{slot.detail}</p>
                    {hl && (
                      <p className="mt-4 text-sm text-sand-300">
                        Three hours where nobody schedules anything. Notifications off, shared rooms quiet. It's the
                        reason the rest of the day can be loud.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── 4. THE EDITIONS (magazine headlines) ───────────────────── */
function Editions({ trips }: { trips: Trip[] | null }) {
  return (
    <section id="editions" className="scroll-mt-16 bg-sand-100">
      <div className="mx-auto max-w-7xl px-5 py-section sm:px-8">
        <div className="mb-12 flex items-end justify-between gap-6">
          <h2 className="font-display text-display-xl font-extrabold text-ink">The editions</h2>
          <p className="hidden max-w-xs text-sm text-ocean-700 sm:block">
            Two houses, two seasons. Sixteen seats each, sold in order of application.
          </p>
        </div>

        {trips === null && <p className="text-ocean-700">Loading…</p>}
        {trips && trips.length === 0 && <p className="text-ocean-700">No editions announced yet.</p>}

        <div className="divide-y divide-sand-300 border-y border-sand-300">
          {trips?.map((trip, i) => {
            const photo = EDITION_PHOTO[trip.spot.slug] ?? photos.hero;
            const soldOut = trip.seats_left <= 0;
            const [place, edition] = trip.title.split(' — ');
            return (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="group grid gap-6 py-10 transition hover:bg-sand-50 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1.6fr)] md:items-center md:gap-10 md:py-14"
              >
                <div className="order-2 flex items-center gap-4 md:order-1 md:block">
                  <img
                    src={src(photo, 480)}
                    alt={photo.alt}
                    loading="lazy"
                    className="h-24 w-32 rounded-xl object-cover grayscale transition duration-500 group-hover:grayscale-0 md:h-40 md:w-full"
                  />
                  <span className="text-xs text-ocean-700 md:mt-2 md:block">
                    N°{i + 1} · {trip.location ?? trip.spot.name}
                  </span>
                </div>

                <div className="order-1 min-w-0 md:order-2">
                  <h3 className="font-display text-display-xl font-extrabold leading-[0.9] text-ink [overflow-wrap:anywhere] group-hover:text-ocean-500">
                    {place}
                  </h3>
                  {edition && (
                    <p className="mt-2 font-display text-display-md font-bold text-ocean-500">{edition}</p>
                  )}
                  {trip.description && <p className="mt-4 max-w-prose text-ocean-800">{trip.description}</p>}
                </div>

                <dl className="order-3 grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:block md:space-y-4 md:border-l md:border-sand-300 md:pl-8">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-ocean-700">Dates</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-ink">
                      {formatDateRange(trip.starts_on, trip.ends_on)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-ocean-700">Seats</dt>
                    <dd className={`mt-1 font-display text-lg font-bold ${soldOut ? 'text-coral' : 'text-ink'}`}>
                      {soldOut ? 'Sold out' : `${trip.capacity} seats · ${trip.seats_left} left`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-ocean-700">Price</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-ink">
                      {hasFoundingPrice(trip) && (
                        <s className="mr-2 text-sm font-normal text-ocean-700/70">{formatUsdc(trip.price_full_usdc!)} USDC</s>
                      )}
                      from {formatUsdc(trip.price_usdc)} USDC
                    </dd>
                    {hasFoundingPrice(trip) && (
                      <dd className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-coral">
                        Founding cohort · {trip.founding_seats} seats
                      </dd>
                    )}
                  </div>
                  <div className="self-end">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-ocean-500 group-hover:underline">
                      Read the edition <span aria-hidden>→</span>
                    </span>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-right text-[11px] text-ocean-700/70">
          Photos: {photos.itamambuca.author} · {photos.praiaDoRosa.author} (Unsplash)
        </p>
      </div>
    </section>
  );
}

/* ───────────────────── 5. WHO IT'S FOR ───────────────────── */
function WhoItsFor() {
  const profiles = [
    {
      title: 'Remote workers',
      photo: photos.remoteWorkers,
      lede: 'You already have the job. You want a fortnight where the job and the ocean fit in the same day.',
      bullets: [
        'A real work room: fibre, monitors, call booths — and three hours a day when nobody interrupts you.',
        'Your afternoons are yours. Coached surf at four, no matter your level.',
        'Fifteen people to eat with, so “remote” stops meaning “alone”.',
      ],
    },
    {
      title: 'Founders and builders',
      photo: photos.builders,
      lede: 'You have a thing you keep not shipping. Two weeks and a demo night is a deadline.',
      bullets: [
        'Demo night on the last Thursday. Everyone shows what they built. No slides required.',
        'Workshops and a hack day in the evenings — from residents, not sponsors.',
        'Introductions before you land, so day one starts at day three.',
      ],
    },
  ];
  return (
    <section className="bg-sand-50">
      <div className="mx-auto max-w-7xl px-5 py-section sm:px-8">
        <h2 className="font-display text-display-xl font-extrabold text-ink">Who it's for</h2>
        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-10">
          {profiles.map((p) => (
            <article key={p.title} className="group">
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={src(p.photo, 900)}
                  srcSet={srcSet(p.photo, [480, 900, 1400])}
                  sizes="(min-width: 768px) 45vw, 100vw"
                  alt={p.photo.alt}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                />
                <Credit photo={p.photo} className="absolute bottom-2 right-3 text-sand-50/70" />
              </div>
              <h3 className="mt-6 font-display text-display-lg font-bold text-ink">{p.title}</h3>
              <p className="mt-2 text-lede text-ocean-800">{p.lede}</p>
              <ul className="mt-5 space-y-3">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-ocean-800">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── 6. HOW PAYING WORKS (no photo) ───────────────────── */
function HowPayingWorks() {
  const steps = [
    {
      n: '01',
      title: 'Pay in your local currency',
      body: 'A regular bank transfer from your phone — no wallet, no exchange, no crypto needed. Today that means Brazilian reais via PIX; more currencies open as P2P.me adds merchant circles.',
    },
    {
      n: '02',
      title: 'A P2P merchant converts it',
      body: 'A verified P2P.me merchant receives your transfer and releases the equivalent USDC. It settles on Base within minutes.',
    },
    {
      n: '03',
      title: 'Drift receives it on-chain',
      body: 'The USDC lands in Drift’s integrator contract and goes straight to the treasury. Your seat is confirmed the moment the order completes.',
      link: { href: CONTRACT_URL, label: 'View the contract on Basescan ↗' },
    },
  ];
  return (
    <section id="paying" className="scroll-mt-16 bg-ink text-sand-50">
      <div className="mx-auto max-w-7xl px-5 py-section sm:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-display-xl font-extrabold">How paying works</h2>
          <p className="mt-4 text-lede text-sand-100/80">
            You never touch crypto unless you want to. The price is in USDC so it's the same for everyone; you pay it
            with money you already have.
          </p>
        </div>

        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-sand-50/20 pt-6">
              <span className="font-display text-display-md font-bold text-coral">{s.n}</span>
              <h3 className="mt-3 font-display text-display-md font-bold">{s.title}</h3>
              <p className="mt-3 text-sand-100/80">{s.body}</p>
              {s.link && (
                <a
                  href={s.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-sm font-semibold text-coral underline-offset-4 hover:underline"
                >
                  {s.link.label}
                </a>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-16 flex flex-col gap-4 border-t border-sand-50/20 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="font-display text-display-md font-bold">
            The contract that holds your payment is public. <span className="text-coral">You can read it.</span>
          </p>
          <a
            href={CONTRACT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-sand-50/30 px-5 py-2.5 text-sm font-semibold hover:border-coral hover:text-coral"
          >
            0x7e1b…bb3F on Base Sepolia ↗
          </a>
        </div>
        <p className="mt-4 text-xs text-sand-100/50">
          Currently on Base Sepolia (testnet) while the integrator is being whitelisted. Only BRL / PIX is enabled today.
        </p>
      </div>
    </section>
  );
}

/* ───────────────────── 7. FAQ (no photo) ───────────────────── */
function Faq() {
  const items = [
    {
      q: 'What exactly is included?',
      a: 'Fourteen nights in the house (room of your choice), breakfast every day and dinner at the long table, coached surf sessions split by level with video review, boards and wetsuits, morning yoga, the work room, the evening programme and demo night, airport transfers on arrival and departure day, and one off-grid day. Flights, lunches, travel insurance and visas are on you.',
    },
    {
      q: "I've never surfed. Is that a problem?",
      a: "No. Sessions are split by level and the first three days exist for exactly this. Itamambuca in January is the friendlier water; Praia do Rosa in autumn is better if you already have a few weeks under you.",
    },
    {
      q: "How do I pay if I don't have crypto?",
      a: "With a bank transfer. Today that's PIX in Brazilian reais: a P2P.me merchant receives your reais and settles the USDC to Drift's contract. No wallet or exchange needed. Other currencies will open as merchant circles do — we won't list one until it works.",
    },
    {
      q: 'Can I cancel?',
      a: "Before your payment completes, yes, at no cost — the seat is released automatically if the order expires or you cancel it. After it completes, write to us: we'll refund if the seat can be filled, and we'll always tell you where you stand. There is no automatic refund path on-chain yet, so please don't pay until you're sure.",
    },
    {
      q: 'What level of English do I need?',
      a: "Enough to work and eat with fifteen people from different countries. Workshops and demo night are in English; the coaches speak Portuguese and English. If you can read this page comfortably, you're fine.",
    },
    {
      q: 'Is the wifi actually good?',
      a: 'Fibre to the house, a dedicated work room with monitors and two call booths, plus a 4G backup. Ubatuba and Praia do Rosa both have real fibre now — we tested it, and we schedule deep work in the window when nobody is on calls.',
    },
  ];
  return (
    <section className="bg-sand-50">
      <div className="mx-auto max-w-7xl px-5 py-section sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
          <h2 className="font-display text-display-xl font-extrabold text-ink">Questions</h2>
          <div className="divide-y divide-sand-300 border-y border-sand-300">
            {items.map((it) => (
              <details key={it.q} className="group py-5">
                <summary className="flex cursor-pointer items-start justify-between gap-6 font-display text-display-md font-bold text-ink">
                  <span>{it.q}</span>
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 text-ocean-500 transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-prose text-ocean-800">{it.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── 8. FOOTER CTA ───────────────────── */
function FooterCta() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-sand-50">
      <img
        src={src(photos.footer, 1600)}
        srcSet={srcSet(photos.footer)}
        sizes="100vw"
        alt={photos.footer.alt}
        loading="lazy"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-ink/60" />
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-5 py-section sm:px-8 md:flex-row md:items-end md:justify-between">
        <p className="max-w-[16ch] font-display text-display-xl font-extrabold">Sixteen seats. Two editions. Pick your water.</p>
        <a
          href="#editions"
          className="inline-flex items-center gap-2 rounded-full bg-sand-50 px-6 py-3 text-sm font-semibold text-ink transition hover:bg-coral hover:text-sand-50"
        >
          See the editions <span aria-hidden>↑</span>
        </a>
      </div>
      <Credit photo={photos.footer} className="absolute bottom-3 right-4 text-sand-100/50" />
    </section>
  );
}

/* ───────────────────── helpers ───────────────────── */
function Credit({ photo, className = '' }: { photo: Photo; className?: string }) {
  return (
    <a
      href={photo.page}
      target="_blank"
      rel="noreferrer"
      className={`text-[10px] tracking-wide hover:underline ${className}`}
      title="Placeholder photo — replace with Drift's own"
    >
      Photo: {photo.author} / Unsplash
    </a>
  );
}
