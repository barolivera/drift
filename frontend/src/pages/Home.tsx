import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Trip } from '@/lib/api';
import { photos, src, srcSet, type Photo } from '@/lib/photos';
import { BlocksMark, LaptopMark, PalmMark, WaveMark } from '@/components/Marks';
import { Inclusions } from '@/components/Inclusions';
import { HOME_INCLUSIONS } from '@/lib/inclusions';
import { EditionCard } from '@/components/EditionCard';
import { Faq } from '@/components/Faq';


/* Layout primitives — one paper page, surface cards float on it. */
const container = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const section = 'py-20 md:py-28';
const h2 = 'text-section font-extrabold tracking-tight text-ink';
const eyebrow = 'pixel text-mute';

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
      <Manifesto />
      <LifeAtTheHouse />
      <Editions trips={trips} />
      <WhoItsFor />
      <FaqSection />
      <FooterCta />
    </div>
  );
}

/* ───────────── 1. HERO — headline on paper, grainy blob behind it, media panel below ───────────── */
function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* gradient blob: forest + lilac + mustard, blurred, low opacity, with grain */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[720px]">
        <div className="blob left-[-6%] top-[-10%] h-[520px] w-[520px] bg-forest opacity-[0.28]" />
        <div className="blob left-[22%] top-[6%] h-[560px] w-[560px] bg-lilac opacity-[0.55]" />
        <div className="blob left-[48%] top-[-14%] h-[480px] w-[480px] bg-mustard opacity-[0.6]" />
        <div className="blob left-[8%] top-[34%] h-[360px] w-[520px] bg-coral opacity-[0.16]" />
        <div className="grain" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-paper" />
      </div>

      <div className={`${container} pt-14 md:pt-24`}>
        <div className="grid gap-8 md:grid-cols-[1.25fr_1fr] md:items-end md:gap-16">
          <div>
            <span className="chip chip-lilac">Drift · Brazil · 2027</span>
            <h1 className="mt-6 max-w-[11ch] text-display-2xl font-extrabold text-ink">
              Two weeks. Sixteen people. One beach.
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#editions" className="btn-primary btn-lg">
                See the editions
              </a>
              <a href="#paying" className="btn-secondary btn-lg">
                How paying works
              </a>
            </div>
          </div>
          <p className="max-w-md text-lede text-ink/80 md:pb-2">
            Surf residencies in Brazil for people who work remotely and build things. Pay in your currency — Drift
            settles in USDC on Base.
          </p>
        </div>

        {/* media panel */}
        <div className="card relative mt-12 p-2 sm:p-3 md:mt-16">
          <div className="relative overflow-hidden rounded-[20px]">
            <img
              src={src(photos.hero, 1600)}
              srcSet={srcSet(photos.hero)}
              sizes="(min-width: 1152px) 1152px, 100vw"
              alt={photos.hero.alt}
              className="aspect-[4/3] w-full object-cover sm:aspect-[21/9]"
            />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-5 sm:top-5">
              <span className="chip chip-mustard">Itamambuca · 16–30 Jan</span>
              <span className="chip chip-lilac">Praia do Rosa · 24 Apr–8 May</span>
            </div>
            <Credit photo={photos.hero} className="absolute bottom-3 right-4 text-paper/70" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────── 2. MANIFESTO — text on the paper ───────────── */
function Manifesto() {
  return (
    <section className={`${container} ${section}`}>
      <p className={eyebrow}>What it is</p>
      <p className="mt-5 max-w-3xl text-display-md font-bold tracking-tight text-ink">
        This is not a surf camp with wifi. Sixteen people share a house for two weeks: mornings in the water, three
        protected hours of work in the middle of the day, and a demo night at the end.{' '}
        <span className="text-coral">You leave with something shipped and fifteen people who saw you build it.</span>
      </p>
    </section>
  );
}

/* ───────────── 3. LIFE AT THE HOUSE — inclusions grid, no hours ───────────── */
function LifeAtTheHouse() {
  return (
    <section className={`${container} pb-20 md:pb-28`}>
      <div className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <div>
          <p className={eyebrow}>Included</p>
          <h2 className={`${h2} mt-3`}>Life at the house</h2>
          <p className="mt-4 max-w-xs text-lede text-ink/80">Same house rules in every edition. Surf, work, eat together.</p>
          <WaveMark className="mt-10 hidden h-28 w-28 text-forest md:block" title="Surf" />
        </div>
        <Inclusions items={HOME_INCLUSIONS} />
      </div>
    </section>
  );
}

/* ───────────── 4. THE EDITIONS — card grid, colour band per edition ───────────── */
function Editions({ trips }: { trips: Trip[] | null }) {
  return (
    <section id="editions" className={`${container} scroll-mt-24 pb-20 md:pb-28`}>
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className={eyebrow}>2027</p>
          <h2 className={`${h2} mt-3`}>Pick your water</h2>
        </div>
        <p className="max-w-xs text-sm text-mute">Two houses, two seasons. Sixteen seats each, sold in order of application.</p>
      </div>

      {trips === null && <p className="text-mute">Loading…</p>}
      {trips && trips.length === 0 && <p className="text-mute">No editions announced yet.</p>}
      {trips && trips.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          {trips.map((trip) => (
            <EditionCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
      <p className="pixel mt-3 text-right text-mute">
        Photos: {photos.itamambuca.author} · {photos.praiaDoRosa.author} (Unsplash)
      </p>
    </section>
  );
}

/* ───────────── 5. WHO IT'S FOR — three feature cards, line icon on top ───────────── */
function WhoItsFor() {
  const profiles = [
    {
      title: 'Remote workers',
      Icon: LaptopMark,
      body: 'You already have the job. You want a fortnight where the job and the ocean fit in the same day — fibre, monitors, call booths, and three hours nobody interrupts.',
    },
    {
      title: 'Founders and builders',
      Icon: BlocksMark,
      body: 'You have a thing you keep not shipping. Two weeks and a demo night on the last Thursday is a deadline. Everyone shows what they built; no slides required.',
    },
    {
      title: 'People who have never surfed',
      Icon: WaveMark,
      body: 'Sessions are split by level and the first three days exist for exactly this. Itamambuca in January is the friendlier water.',
    },
  ];
  return (
    <section className={`${container} pb-20 md:pb-28`}>
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className={eyebrow}>Residents</p>
          <h2 className={`${h2} mt-3`}>Who it's for</h2>
        </div>
        <Link to="/trips" className="btn-secondary self-start md:self-auto">
          See the trips
        </Link>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {profiles.map(({ title, Icon, body }) => (
          <FeatureCard key={title} title={title} body={body} Icon={Icon} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  body,
  Icon,
  badge,
}: {
  title: string;
  body: React.ReactNode;
  Icon: (p: React.SVGProps<SVGSVGElement> & { title?: string }) => JSX.Element;
  badge?: React.ReactNode;
}) {
  return (
    <article className="card group flex flex-col p-6 sm:p-8">
      <div className="flex items-start justify-between">
        {badge ?? <span />}
      </div>
      <div className="flex h-52 items-center justify-center md:h-64">
        <Icon className="h-40 w-40 text-ink transition-colors duration-300 group-hover:text-forest md:h-48 md:w-48" title={title} />
      </div>
      <h3 className="mt-2 text-lg font-bold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
    </article>
  );
}

/* ───────────── 6. FAQ — one card; "How does paying work?" lives here now ───────────── */
function FaqSection() {
  return (
    <section id="faq" className={`${container} scroll-mt-24 pb-20 md:pb-28`}>
      <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:gap-16">
        <div>
          <p className={eyebrow}>FAQ</p>
          <h2 className={`${h2} mt-3`}>Questions</h2>
        </div>
        <Faq />
      </div>
    </section>
  );
}

/* ───────────── 8. FOOTER CTA — photo card, palm line icon ───────────── */
function FooterCta() {
  return (
    <section className={`${container} pb-20 md:pb-28`}>
      <div className="card relative isolate overflow-hidden text-paper">
        <img
          src={src(photos.footer, 1600)}
          srcSet={srcSet(photos.footer)}
          sizes="(min-width: 1152px) 1152px, 100vw"
          alt={photos.footer.alt}
          loading="lazy"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-ink/55" />
        <div className="flex flex-col items-start gap-8 p-8 sm:p-12 md:flex-row md:items-end md:justify-between md:p-16">
          <div>
            <PalmMark className="mb-6 h-20 w-20 text-paper" title="Drift" />
            <p className="max-w-[16ch] text-display-lg font-extrabold">Sixteen seats. Two editions. Pick your water.</p>
          </div>
          <a href="#editions" className="btn-primary btn-lg">
            See the editions ↑
          </a>
        </div>
        <Credit photo={photos.footer} className="absolute bottom-3 right-4 text-paper/60" />
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
      className={`pixel normal-case hover:underline ${className}`}
      title="Placeholder photo — replace with Drift's own"
    >
      Photo: {photo.author} / Unsplash
    </a>
  );
}
