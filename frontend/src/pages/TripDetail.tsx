import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { api, formatDateRange, nights, hasFoundingPrice, type Trip } from '@/lib/api';
import { PriceTag } from '@/components/PriceTag';
import { Inclusions } from '@/components/Inclusions';
import { FaqSection } from '@/components/FaqSection';
import { ui } from '@/lib/ui';
import { inclusionsFrom } from '@/lib/inclusions';
import { photos, src, srcSet, type Photo } from '@/lib/photos';

const { content: container, eyebrow, h2 } = ui;

/* Per-spot copy that isn't in the DB yet: the place photo and how to get there. */
const SPOT: Record<string, { hero: Photo; house: Photo; airport: string; transfer: string }> = {
  itamambuca: {
    hero: photos.itamambuca,
    house: photos.remoteWorkers,
    airport: 'Fly into São Paulo (GRU).',
    transfer: 'We pick you up at the airport on arrival day — about four hours to the house along the coast — and take you back on departure day.',
  },
  'praia-do-rosa': {
    hero: photos.praiaDoRosa,
    house: photos.builders,
    airport: 'Fly into Florianópolis (FLN).',
    transfer: 'We pick you up at the airport on arrival day — about ninety minutes south to the bay — and take you back on departure day.',
  },
};

/**
 * Edition page. Order: hero → the place → what's included → logistics →
 * book → FAQ. No day-by-day schedule anywhere.
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

  if (error && !trip) return <p className={`${container} py-10 text-red-700`}>{error}</p>;
  if (!trip) return <p className={`${container} py-10 text-mute`}>Loading…</p>;

  const soldOut = trip.seats_left <= 0;
  const spot = SPOT[trip.spot.slug] ?? { hero: photos.hero, house: photos.remoteWorkers, airport: '', transfer: '' };
  const [place, edition] = trip.title.split(' — ');
  const paragraphs = (trip.description_long ?? '').split(/\n\s*\n/).filter(Boolean);
  const inclusions = inclusionsFrom(trip.included);

  function bookNow() {
    if (!authenticated) return login();
    navigate(`/trips/${trip!.id}/book`);
  }

  const bookButton = (
    <button onClick={bookNow} disabled={!ready || soldOut} className="btn-primary btn-lg">
      {!ready ? 'Loading…' : soldOut ? 'Sold out' : authenticated ? 'Book Now' : 'Log in to book'}
    </button>
  );

  return (
    <article className="bg-paper text-ink">
      {/* a. HERO — photo framed inside the content column, title card overlapping it */}
      <section className={`${container} pt-6 md:pt-10`}>
        <div className="relative overflow-hidden rounded-[28px] bg-surface">
          <img
            src={src(spot.hero, 1800)}
            srcSet={srcSet(spot.hero)}
            sizes="(min-width: 1152px) 1152px, 100vw"
            alt={spot.hero.alt}
            className="aspect-[4/3] w-full object-cover sm:aspect-[16/9] md:aspect-[21/9]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/5 to-transparent" />
          <Credit photo={spot.hero} className="absolute bottom-3 right-4 text-paper/70" />
        </div>
        <div className="card-paper relative -mt-14 max-w-3xl p-6 sm:p-10 md:-mt-24 md:ml-10">
          <div className="flex flex-wrap gap-2">
            <span className="chip chip-lilac">{formatDateRange(trip.starts_on, trip.ends_on)}</span>
            <span className="chip chip-ghost">{trip.location ?? `${trip.spot.name}, ${trip.spot.state}`}</span>
            {hasFoundingPrice(trip) && <span className="chip chip-coral">Founding cohort · {trip.founding_seats} seats</span>}
          </div>
          <h1 className={`${ui.h1} mt-5`}>{place}</h1>
          {edition && <p className="mt-1 text-xl font-bold text-mute">{edition}</p>}
          {trip.description && <p className={`${ui.lede} mt-5 max-w-prose`}>{trip.description}</p>}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {bookButton}
            <a href="#logistics" className="btn-secondary btn-lg">
              Dates & logistics
            </a>
          </div>
        </div>
      </section>

      {/* b. THE PLACE — description + photo */}
      <section className={`${container} py-20 md:py-24`}>
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <div>
            <p className={eyebrow}>The place</p>
            <h2 className={`${h2} mt-4`}>The house at {trip.spot.name}</h2>
            <div className="mt-6 space-y-4 text-ink/80">
              {paragraphs.map((para, i) => (
                <p key={i} className={i === 0 ? 'text-lede' : 'leading-relaxed'}>
                  {para}
                </p>
              ))}
              {trip.who_its_for && (
                <p className="rounded-2xl bg-surface p-5 text-sm leading-relaxed text-ink/80">
                  <span className="label mb-2 block text-mute">Who this edition is for</span>
                  {trip.who_its_for}
                </p>
              )}
            </div>
          </div>
          <div className="card relative p-2">
            <img
              src={src(spot.house, 1000)}
              srcSet={srcSet(spot.house, [480, 1000, 1400])}
              sizes="(min-width: 768px) 45vw, 100vw"
              alt={spot.house.alt}
              loading="lazy"
              className="aspect-[4/5] w-full rounded-2xl object-cover md:aspect-[4/4.6]"
            />
            <Credit photo={spot.house} className="absolute bottom-4 right-5 text-paper/70" />
          </div>
        </div>
      </section>

      {/* c. INCLUSIONS — same grid as the Home */}
      <section className={`${container} py-20 md:py-24`}>
        <div className="card p-6 sm:p-10">
          <div className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
            <div>
              <p className={eyebrow}>Included</p>
              <h2 className={`${h2} mt-4`}>What two weeks include</h2>
              {trip.not_included.length > 0 && (
                <p className="mt-5 text-sm text-mute">
                  <span className="label mb-1.5 block">Not included</span>
                  {trip.not_included.join(' · ')}
                </p>
              )}
            </div>
            <Inclusions items={inclusions} />
          </div>
        </div>
      </section>

      {/* d. LOGISTICS — dates, seats, getting there. No day-by-day schedule. */}
      <section id="logistics" className={`${container} scroll-mt-24 py-20 md:py-24`}>
        <p className={eyebrow}>Logistics</p>
        <h2 className={`${h2} mt-4`}>Dates and getting there</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="card p-6 sm:p-8">
            <p className={eyebrow}>Dates</p>
            <p className="mt-3 text-2xl font-extrabold tracking-tight">{formatDateRange(trip.starts_on, trip.ends_on)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip chip-lilac">{nights(trip.starts_on, trip.ends_on)} nights</span>
              <span className="chip chip-ghost">Arrive {trip.starts_on.slice(5)} · leave {trip.ends_on.slice(5)}</span>
            </div>
          </div>
          <div className="card p-6 sm:p-8">
            <p className={eyebrow}>Seats</p>
            <p className="mt-3 text-2xl font-extrabold tracking-tight">{trip.capacity} residents</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={soldOut ? 'chip chip-ghost' : 'chip chip-forest'}>
                {soldOut ? 'Sold out' : `${trip.seats_left} of ${trip.capacity} left`}
              </span>
              <span className="chip chip-ghost">Sold in order of application</span>
            </div>
          </div>
          <div className="card p-6 sm:p-8">
            <p className={eyebrow}>Getting there</p>
            <p className="mt-3 text-2xl font-extrabold tracking-tight">{spot.airport || 'By air'}</p>
            <p className="mt-3 text-sm leading-relaxed text-mute">{spot.transfer}</p>
          </div>
        </div>
      </section>

      {/* e. BOOK — the CTA card */}
      <section className={`${container} py-20 md:py-24`}>
        <div className="card flex flex-col gap-6 p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={eyebrow}>Reserve your seat</p>
            <PriceTag trip={trip} size="lg" className="mt-3" />
            {hasFoundingPrice(trip) && (
              <p className="mt-2 max-w-md text-sm text-mute">
                Launch price for the first {trip.founding_seats} residents of this edition. Regular price after that.
              </p>
            )}
            <p className="mt-3 text-sm text-mute">Two-minute form, then pay by PIX. Seat held while you pay.</p>
          </div>
          <div className="shrink-0">{bookButton}</div>
        </div>
      </section>

      {/* f. FAQ — shared band; "How does paying work?" lives here */}
      <FaqSection />
    </article>
  );
}

function Credit({ photo, className = '' }: { photo: Photo; className?: string }) {
  return (
    <a href={photo.page} target="_blank" rel="noreferrer" className={`label normal-case hover:underline ${className}`} title="Placeholder photo — replace with Drift's own">
      Photo: {photo.author} / Unsplash
    </a>
  );
}
