import { useEffect, useState } from 'react';

import { api, type Trip } from '@/lib/api';
import { photos, src, srcSet, type Photo } from '@/lib/photos';
import { BlocksMark, LaptopMark, PalmMark, Patch, WaveMark } from '@/components/Marks';
import { Inclusions } from '@/components/Inclusions';
import { HOME_INCLUSIONS } from '@/lib/inclusions';
import { EditionCard } from '@/components/EditionCard';
import { Faq } from '@/components/Faq';
import { ScrollReveal } from '@/components/ScrollReveal';


/* Layout primitives — one paper page, surface cards float on it. */
const container = 'w-full px-6 md:px-10 xl:px-12'; // hero: wide, small inset
const content = 'mx-auto w-full max-w-6xl px-6 md:px-8'; // body: narrower, centred, editorial (Lunte)
const section = 'py-20 md:py-24';
const h2 = 'display text-[clamp(2.5rem,5.2vw,4.5rem)] text-ink';

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
      <FooterCta />
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
    <section className={`${content} pb-32 md:pb-44`}>
      <h2 className={`${h2} max-w-[12ch] uppercase`}>Life at the house</h2>
      <Inclusions items={HOME_INCLUSIONS} variant="plain" className="mt-14 md:mt-20" />
    </section>
  );
}

/* ───────────── 4. THE EDITIONS — card grid, colour band per edition ───────────── */
function Editions({ trips }: { trips: Trip[] | null }) {
  return (
    <section id="editions" className={`${content} scroll-mt-24 py-20 md:py-24`}>
      <h2 className={`${h2} mb-8`}>Pick your water</h2>

      {trips === null && <p className="text-mute">Loading…</p>}
      {trips && trips.length === 0 && <p className="text-mute">No editions announced yet.</p>}
      {trips && trips.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          {trips.map((trip) => (
            <EditionCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
      <p className="label mt-3 text-right text-mute">
        Photos: {photos.itamambuca.author} · {photos.praiaDoRosa.author} (Unsplash)
      </p>
    </section>
  );
}

/* ───────────── 5. WHO IT'S FOR — three tall surface cards, big line icon, title + one line (ElevenLabs "Safety, built in") ───────────── */
function WhoItsFor() {
  const profiles = [
    {
      title: 'Remote workers',
      Icon: LaptopMark,
      body: 'You already have the job. You want a fortnight where the job and the ocean fit in the same day.',
    },
    {
      title: 'Founders and builders',
      Icon: BlocksMark,
      body: 'You have a thing you keep not shipping. Two weeks and a demo night is a deadline.',
    },
    {
      title: 'People who have never surfed',
      Icon: WaveMark,
      body: 'Sessions are split by level and the first three days exist for exactly this.',
    },
  ];
  return (
    <section id="who" className={`${content} ${section}`}>
      <h2 className={h2}>Who it's for</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
        {profiles.map(({ title, Icon, body }) => (
          <article key={title} className="card flex min-h-[520px] flex-col p-8 md:min-h-[600px] sm:p-10">
            <div className="flex flex-1 items-center justify-center py-6">
              <Icon className="h-48 w-48 text-ink md:h-56 md:w-56" title={title} />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-ink">{title}</h3>
            <p className="mt-3 text-base leading-relaxed text-mute">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ───────────── 6. FAQ — one card; "How does paying work?" lives here now ───────────── */
function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 bg-surface py-20 md:py-24">
      <div className={content}>
        <p className="label text-center text-sm text-mute">Common questions</p>
        <Faq className="mt-10" />
      </div>
    </section>
  );
}

/* ───────────── 8. FOOTER CTA — dark band, photo, big title (Le Camp "Prêt à gravir les sommets") ───────────── */
function FooterCta() {
  return (
    <section className={`${content} pb-6 pt-20 md:pt-24`}>
      <div className="relative isolate overflow-hidden rounded-[28px] bg-ink text-paper">
        <img
          src={src(photos.hero, 1600)}
          srcSet={srcSet(photos.hero)}
          sizes="100vw"
          alt={photos.hero.alt}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-bottom grayscale"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/85 via-ink/55 to-ink/25" />
        <div className="flex min-h-[520px] flex-col items-start justify-between gap-10 p-8 sm:p-12 md:p-16">
          <div className="flex w-full items-start justify-between">
            <p className="label text-paper/70">Brazil · 2027</p>
            <Patch Icon={PalmMark} title="Drift" className="h-20 text-paper/80" />
          </div>
          <div className="grid w-full gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 className="display max-w-[14ch] text-[clamp(2.25rem,5.6vw,4.75rem)]">Sixteen seats. Two editions. Pick your water.</h2>
              <p className="mt-4 max-w-md text-base text-paper/70">Pay in your currency; Drift settles in USDC on Base. Seat held while you pay.</p>
            </div>
            <a href="#editions" className="btn-primary btn-lg">
              See the editions ↑
            </a>
          </div>
        </div>
        <Credit photo={photos.hero} className="absolute bottom-3 right-4 text-paper/50" />
      </div>
    </section>
  );
}

/* ───────────── helpers ───────────── */
function Credit({ photo, className = '' }: { photo: Photo; className?: string }) {
  return (
    <a
      href={photo.page}
      target="_blank"
      rel="noreferrer"
      className={`label normal-case hover:underline ${className}`}
      title="Placeholder photo — replace with Drift's own"
    >
      Photo: {photo.author} / Unsplash
    </a>
  );
}
