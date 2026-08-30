import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { api, formatDateRange, formatUsdc, hasFoundingPrice, type Trip } from '@/lib/api';
import { Inclusions } from '@/components/Inclusions';
import { FaqSection } from '@/components/FaqSection';
import { ui } from '@/lib/ui';
import { inclusionsFrom } from '@/lib/inclusions';
import { photos, src, type Photo } from '@/lib/photos';

const { hero: wide, content, sectionTitle: h2 } = ui;

interface Picture {
  src: string;
  alt: string;
}
const fromPhoto = (p: Photo, width: number): Picture => ({ src: src(p, width), alt: p.alt });

/* Per-spot pictures and copy that aren't in the DB yet. */
const SPOT: Record<string, { hero: Picture; gallery: Picture[]; airport: string; transfer: string }> = {
  itamambuca: {
    hero: { src: '/images/hero-color.png', alt: 'A river mouth meeting the beach at Itamambuca, Ubatuba' },
    gallery: [
      'The house and the pool from the garden',
      'Sun loungers on the pool deck',
      'The living room',
      'Living room and the long dining table',
      'The kitchen',
      'The outdoor kitchen and barbecue',
      'A double room opening onto the balcony',
      'A twin room',
    ].map((alt, i) => ({ src: `/images/editions/itamambuca-house-${i + 1}.jpg`, alt })),
    airport: 'Fly into São Paulo (GRU).',
    transfer: 'We pick you up at the airport on arrival day — about four hours to the house along the coast — and take you back on departure day.',
  },
  'praia-do-rosa': {
    hero: { src: '/images/editions/praia-do-rosa-hero.png', alt: 'Praia do Rosa from above: the bay, the beach and the lagoon behind it' },
    gallery: [
      'The long table under the pergola, looking out to the bay',
      'The deck and the stone house',
      'The path to the front door',
      'The veranda over the garden',
      'The dining room under the timber roof',
      'Kitchen and dining room',
      'A double room',
      'The view over Praia do Rosa',
    ].map((alt, i) => ({ src: `/images/editions/praia-do-rosa-house-${i + 1}.jpg`, alt })),
    airport: 'Fly into Florianópolis (FLN).',
    transfer: 'We pick you up at the airport on arrival day — about ninety minutes south to the bay — and take you back on departure day.',
  },
};
const FALLBACK_SPOT = { hero: fromPhoto(photos.hero, 2000), gallery: [fromPhoto(photos.remoteWorkers, 1400)], airport: '', transfer: '' };

/**
 * Edition page. One template for every edition, fed by the trip:
 * hero + title card → the house (copy + gallery) → life at the house →
 * dates and prices → FAQ. No day-by-day schedule anywhere.
 */
export function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ready, authenticated, login } = usePrivy();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) api<Trip>(`/api/trips/${id}`).then(setTrip).catch((e) => setError(e.message));
  }, [id]);

  if (error && !trip) return <p className={`${content} py-32 text-red-700`}>{error}</p>;
  if (!trip) return <p className={`${content} py-32 text-mute`}>Loading…</p>;

  const soldOut = trip.seats_left <= 0;
  const spot = SPOT[trip.spot.slug] ?? FALLBACK_SPOT;
  const [place] = trip.title.split(' — ');
  const paragraphs = (trip.description_long ?? '').split(/\n\s*\n/).filter(Boolean);
  const inclusions = inclusionsFrom(trip.included);

  function bookNow() {
    if (!authenticated) return login();
    navigate(`/trips/${trip!.id}/book`);
  }

  const bookButton = (
    <button onClick={bookNow} disabled={!ready || soldOut} className="btn-primary px-6 py-3 text-base">
      {!ready ? 'Loading…' : soldOut ? 'Sold out' : authenticated ? 'Book now' : 'Log in to book'}
    </button>
  );

  return (
    <article className="bg-paper text-ink">
      {/* a. HERO — boxed photo with the nav on it, title card in the corner */}
      <section className={`${wide} pt-[var(--gutter)]`}>
        <div className="relative isolate h-[calc(100svh-2*var(--gutter))] min-h-[560px] overflow-hidden rounded-[28px] bg-ink text-paper">
          <img src={spot.hero.src} alt={spot.hero.alt} className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center]" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-ink/20" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-ink/50 to-transparent" />

          <div className="card-paper absolute bottom-6 left-4 right-4 p-6 text-ink sm:left-8 sm:right-auto sm:bottom-7 sm:max-w-[768px] sm:p-10 md:left-12">
            <p className="text-xl font-bold uppercase leading-7">{formatDateRange(trip.starts_on, trip.ends_on)}</p>
            <h1 className="display mt-5 text-[clamp(2.75rem,5.3vw,4.75rem)] leading-[1.05]">{place}</h1>
            {trip.description && <p className="mt-5 max-w-[688px] text-lg leading-[1.5] text-ink/80 sm:text-xl">{trip.description}</p>}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {bookButton}
              <a href="#logistics" className="btn-secondary px-6 py-3 text-base">
                Dates &amp; logistics
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* b. THE HOUSE — copy left, gallery right */}
      <section className={`${wide} py-24`}>
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:justify-center">
          <div className="w-full max-w-[627px] lg:min-w-0 lg:flex-1">
            <h2 className={h2}>The house</h2>
            <div className="mt-6 space-y-5 text-lg leading-[1.5] text-ink/80 sm:text-xl">
              {paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
          <Gallery pictures={spot.gallery} />
        </div>
      </section>

      {/* c. LIFE AT THE HOUSE — same list as the Home */}
      <section className={`${content} pb-32 pt-12 md:pb-44`}>
        <h2 className={h2}>Life at the house</h2>
        <Inclusions items={inclusions} variant="list" className="mt-20" />
      </section>

      {/* d. DATES AND PRICES */}
      <section id="logistics" className={`${content} scroll-mt-24 py-24`}>
        <h2 className={h2}>Dates and prices</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <InfoCard title="Dates" value={formatDateRange(trip.starts_on, trip.ends_on)} />
          <InfoCard title="Getting there" value={spot.airport || 'By air'} note={spot.transfer} />
          <InfoCard
            title="Reserve your seat"
            value={`${formatUsdc(trip.price_usdc)} USDC`}
            note={
              soldOut
                ? 'This edition is sold out.'
                : hasFoundingPrice(trip)
                  ? `Launch price for the first ${trip.founding_seats} residents of this edition.`
                  : `${trip.seats_left} of ${trip.capacity} seats left.`
            }
          >
            {bookButton}
          </InfoCard>
        </div>
      </section>

      {/* e. FAQ — shared band; "How does paying work?" lives here */}
      <FaqSection />
    </article>
  );
}

/** Surface card: small title, one bold value, an optional note and an optional action. */
function InfoCard({ title, value, note, children }: { title: string; value: string; note?: string; children?: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-[20px] bg-surface p-10">
      <h3 className="text-xl font-semibold leading-7 tracking-[-0.5px] text-ink">{title}</h3>
      <p className="text-2xl font-extrabold leading-8 tracking-[-0.6px] text-ink">{value}</p>
      {note && <p className="text-base leading-[1.5] text-ink">{note}</p>}
      {children && <div className="pt-1">{children}</div>}
    </article>
  );
}

/** One picture at a time in a surface frame; the arrows page through the rest. */
function Gallery({ pictures }: { pictures: Picture[] }) {
  const [index, setIndex] = useState(0);
  const count = pictures.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);
  const current = pictures[index];
  const arrow =
    'display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper text-2xl leading-none text-ink shadow-soft transition hover:bg-surface disabled:opacity-40';
  return (
    <div className="flex w-full items-center justify-center gap-3 lg:w-auto lg:shrink-0">
      <button type="button" onClick={() => go(-1)} disabled={count < 2} aria-label="Previous photo" className={arrow}>
        <span aria-hidden>←</span>
      </button>
      {/* 769×889 frame in the design; shrinks with the viewport below 1920 */}
      <div className="w-full max-w-[769px] rounded-[20px] bg-surface p-2 shadow-soft lg:w-[min(769px,46vw)]">
        <img key={current.src} src={current.src} alt={current.alt} className="aspect-[755/871] w-full rounded-[16px] object-cover" />
      </div>
      <button type="button" onClick={() => go(1)} disabled={count < 2} aria-label="Next photo" className={arrow}>
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
