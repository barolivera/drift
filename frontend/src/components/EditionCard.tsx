import { Link } from 'react-router-dom';
import { formatDateRange, formatUsdc, type Trip } from '@/lib/api';
import { photos, src, srcSet, type Photo } from '@/lib/photos';

const BAND: Record<string, { band: string; text: string; photo: Photo }> = {
  itamambuca: { band: 'bg-forest', text: 'text-paper', photo: photos.itamambuca },
  'praia-do-rosa': { band: 'bg-coral', text: 'text-paper', photo: photos.praiaDoRosa },
};

/**
 * Edition card: vertical photo on top, solid colour band below with the
 * edition name and a small underlined pixel label. The whole card is a link.
 */
export function EditionCard({ trip }: { trip: Trip }) {
  const style = BAND[trip.spot.slug] ?? { band: 'bg-ink', text: 'text-paper', photo: photos.hero };
  const [place, edition] = trip.title.split(' — ');
  const soldOut = trip.seats_left <= 0;
  return (
    <Link to={`/trips/${trip.id}`} className="group block overflow-hidden rounded-3xl shadow-soft transition hover:shadow-pop">
      <div className="relative overflow-hidden bg-surface">
        <img
          src={src(style.photo, 900)}
          srcSet={srcSet(style.photo, [480, 900, 1400])}
          sizes="(min-width: 768px) 45vw, 100vw"
          alt={style.photo.alt}
          className="aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-[1.03] sm:aspect-[4/5]"
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="chip chip-lilac">{formatDateRange(trip.starts_on, trip.ends_on)}</span>
          <span className={soldOut ? 'chip chip-ghost' : 'chip chip-mustard'}>
            {soldOut ? 'Sold out' : `${trip.seats_left} of ${trip.capacity} seats`}
          </span>
        </div>
      </div>
      <div className={`${style.band} ${style.text} px-6 py-7 sm:px-8 sm:py-8`}>
        <h3 className="text-display-md font-extrabold">{place}</h3>
        {edition && <p className="mt-1 text-base font-semibold opacity-80">{edition}</p>}
        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="pixel underline decoration-1 underline-offset-4 group-hover:decoration-2">See the edition</span>
          <span className="pixel opacity-80">from {formatUsdc(trip.price_usdc)} USDC</span>
        </div>
      </div>
    </Link>
  );
}
