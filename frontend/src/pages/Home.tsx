import { useEffect, useState } from 'react';

import { api, type Trip } from '@/lib/api';
import { Inclusions } from '@/components/Inclusions';
import { HOME_INCLUSIONS } from '@/lib/inclusions';
import { EditionCard } from '@/components/EditionCard';
import { FaqSection } from '@/components/FaqSection';
import { ui } from '@/lib/ui';
import { ScrollReveal } from '@/components/ScrollReveal';


const { hero: container, content, sectionTitle: h2 } = ui;

export function Home() {
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    api<Trip[]>('/api/trips')
      .then(setTrips)
      .catch(() => setTrips([]));
  }, []);

  return (
    <div className="bg-paper text-ink">
      <Hero />
      <WhatItIs />
      <LifeAtTheHouse />
      <Editions trips={trips} />
      <WhoItsFor />
      <FaqSection />
    </div>
  );
}

/* ───────────── 1. HERO — full-bleed photo, dark scrim left→right, light text ───────────── */
// Drift's own photo (public/images), dithered — no credit line needed.
const HERO_BW = '/images/hero-bw.png';
const HERO_COLOR = '/images/hero-color.png';

function Hero() {
  return (
    <section className={`${container} pt-[var(--gutter)]`}>
      {/* .hero-frame mounts full-viewport and settles into this rounded box (see index.css) */}
      <div className="hero-frame relative isolate overflow-hidden bg-ink text-paper">
        {/* starts in black & white, the colour version fades in once the frame has settled */}
        <img
          src={HERO_BW}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]"
        />
        <img
          src={HERO_COLOR}
          alt="A river mouth meeting the beach at Itamambuca, Ubatuba"
          fetchPriority="high"
          className="hero-color absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-ink/35" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-ink/50 to-transparent" />

        <div className="flex h-full flex-col items-center justify-center px-6 py-24 text-center sm:px-12">
          <h1 className="display text-[clamp(2.5rem,7.8vw,7rem)] text-paper">
            Pause. Reconnect.
            <br />
            Build Together.
          </h1>
        </div>
        <a
          href="#what"
          aria-label="Scroll to what it is"
          className="absolute bottom-6 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-paper text-ink shadow-soft transition hover:bg-surface"
        >
          <span aria-hidden>↓</span>
        </a>
      </div>
    </section>
  );
}

/* ───────────── 2. WHAT IT IS — text on the paper ───────────── */
function WhatItIs() {
  return (
    // extra room above and below so the fill completes before "Life at the house" arrives
    <section id="what" className={`${content} scroll-mt-20 py-32 md:py-48`}>
      <ScrollReveal
        className="max-w-5xl text-[clamp(1.75rem,3.4vw,3rem)] font-normal leading-[1.17] tracking-[-0.01em]"
        segments={[
          {
            text: "Drift is a seasonal surf residency for people who build — in code, in community, in life. Mornings for deep work. Afternoons for surf, yoga, and the conversations that don't happen over Slack.",
          },
        ]}
      />
    </section>
  );
}

/* ───────────── 3. LIFE AT THE HOUSE — inclusions grid, no hours ───────────── */
function LifeAtTheHouse() {
  return (
    <section className={`${content} pb-32 pt-12 md:pb-44`}>
      <h2 className={h2}>Life at the house</h2>
      <Inclusions items={HOME_INCLUSIONS} variant="list" className="mt-20" />
    </section>
  );
}

/* ───────────── 4. THE EDITIONS — card grid, colour band per edition ───────────── */
function Editions({ trips }: { trips: Trip[] | null }) {
  return (
    <section id="editions" className={`${content} scroll-mt-24 py-24`}>
      <h2 className={`${h2} mb-6`}>Pick your water</h2>

      {trips === null && <p className="text-mute">Loading…</p>}
      {trips && trips.length === 0 && <p className="text-mute">No editions announced yet.</p>}
      {trips && trips.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {trips.map((trip) => (
            <EditionCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ───────────── 5. WHO IT'S FOR — three deep-forest cards, a big paper glyph, title + one line ───────────── */
const PROFILES = [
  {
    title: 'Remote workers',
    body: 'You already have the job. You want a fortnight where the job and the ocean fit in the same day.',
    art: { src: '/images/marks/who-remote.svg', w: 171, h: 209 },
  },
  {
    title: 'Founders and builders',
    body: 'You have a thing you keep not shipping. Two weeks and a demo night is a deadline.',
    art: { src: '/images/marks/who-founders.svg', w: 181, h: 160 },
  },
  {
    title: 'People who have never surfed',
    body: 'Sessions are split by level and the first three days exist for exactly this.',
    art: { src: '/images/marks/who-surf.svg', w: 267, h: 257 },
  },
];

function WhoItsFor() {
  return (
    <section id="who" className={`${content} py-24`}>
      <h2 className={h2}>Who it's for</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PROFILES.map(({ title, body, art }) => (
          <article key={title} className="flex flex-col gap-6 rounded-[20px] bg-forest-deep p-10 text-paper">
            {/* glyph box: 257px tall, artwork at its exported size */}
            <div className="flex h-[257px] items-center justify-center py-6">
              <img src={art.src} alt="" width={art.w} height={art.h} style={{ width: art.w, height: art.h }} className="max-w-full" />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-semibold leading-7 tracking-[-0.5px]">{title}</h3>
              <p className="text-[18px] leading-[26px]">{body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
