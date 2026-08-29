import { Link } from 'react-router-dom';
import { formatDateRange, type Trip } from '@/lib/api';
import { photos, src, srcSet, type Photo } from '@/lib/photos';
import { CalendarMark, SeatMark } from '@/components/Marks';

const STUB: Record<string, { bg: string; photo: Photo }> = {
  itamambuca: { bg: 'bg-forest', photo: photos.itamambuca },
  'praia-do-rosa': { bg: 'bg-coral', photo: photos.praiaDoRosa },
};

/**
 * Boarding-pass edition card. Segment 1 is the photo, clean; a perforation
 * divides it from the stub, a solid-colour segment per edition with the
 * metadata row, the edition name in Geist Pixel and "See the edition".
 * No price here — the edition page carries it. The whole card is a link.
 */
export function EditionCard({ trip }: { trip: Trip }) {
  const stub = STUB[trip.spot.slug] ?? { bg: 'bg-ink', photo: photos.hero };
  const [place, edition] = trip.title.split(' — ');
  const soldOut = trip.seats_left <= 0;
  return (
    <Link to={`/trips/${trip.id}`} className="group block transition hover:-translate-y-0.5">
      {/* segment 1 — photo */}
      <div className="relative overflow-hidden rounded-t-[20px] bg-surface shadow-soft">
        <img
          src={src(stub.photo, 900)}
          srcSet={srcSet(stub.photo, [480, 900, 1400])}
          sizes="(min-width: 768px) 45vw, 100vw"
          alt={stub.photo.alt}
          className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.02]"
        />
      </div>

      {/* perforation */}
      <div className={`relative h-0 ${stub.bg}`} aria-hidden>
        <span className="absolute -left-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-paper" />
        <span className="absolute -right-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-paper" />
        <span className="absolute inset-x-5 top-0 border-t border-dashed border-paper/60" />
      </div>

      {/* segment 2 — stub */}
      <div className={`${stub.bg} rounded-b-[15px] px-6 pb-6 pt-7 text-paper sm:px-8 sm:pb-8 sm:pt-8`}>
        <div className="label flex flex-wrap items-center gap-x-5 gap-y-2 text-paper/85">
          <span className="inline-flex items-center gap-1.5">
            <CalendarMark className="h-4 w-4" /> {formatDateRange(trip.starts_on, trip.ends_on)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <SeatMark className="h-4 w-4" /> {soldOut ? 'Sold out' : `${trip.seats_left} of ${trip.capacity} seats`}
          </span>
        </div>
        <h3 className="display mt-5 text-[clamp(2rem,4vw,3rem)] text-paper">{place}</h3>
        {edition && <p className="mt-1 text-sm font-semibold text-paper/80">{edition}</p>}
        <div className="mt-6 flex justify-end">
          <span className="label inline-flex items-center gap-2 underline decoration-1 underline-offset-4 group-hover:decoration-2">
            See the edition <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
