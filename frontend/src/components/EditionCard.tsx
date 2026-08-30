import { Link } from 'react-router-dom';
import { formatDateRange, type Trip } from '@/lib/api';
import { photos, src, type Photo } from '@/lib/photos';

/** Dithered edition artwork (public/images/editions), same treatment as the hero. */
const ART: Record<string, { src: string; alt: string }> = {
  itamambuca: { src: '/images/editions/itamambuca.png', alt: photos.itamambuca.alt },
  'praia-do-rosa': { src: '/images/editions/praia-do-rosa.png', alt: photos.praiaDoRosa.alt },
};
const fallback = (photo: Photo) => ({ src: src(photo, 900), alt: photo.alt });

/**
 * Edition card: a square photo inset in a soft card, a dashed rule, then the
 * dates, the place in Geist Pixel and "See Edition". No price, no seat count
 * here — the edition page carries them. The whole card is a link.
 */
export function EditionCard({ trip }: { trip: Trip }) {
  const art = ART[trip.spot.slug] ?? fallback(photos.hero);
  const [place] = trip.title.split(' — ');
  return (
    <Link to={`/trips/${trip.id}`} className="group block transition hover:-translate-y-0.5">
      <div className="rounded-t-[12px] rounded-b-[24px] bg-surface-3">
        <div className="p-6">
          <div className="aspect-square overflow-hidden rounded-[8px]">
            <img
              src={art.src}
              alt={art.alt}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
            />
          </div>
        </div>
        <div aria-hidden className="mx-[11%] border-t border-dashed border-[#bfbfba]" />
        <div className="flex flex-col gap-7 py-5 pl-6 pr-[18px]">
          <p className="flex items-center gap-2.5 text-[18px] font-semibold uppercase tracking-[0.8px] text-ink">
            <img src="/images/marks/calendar.svg" alt="" width={20} height={20} className="h-5 w-5" />
            {formatDateRange(trip.starts_on, trip.ends_on)}
          </p>
          <div>
            <h3 className="display text-[3rem] leading-10 tracking-[-0.5px] text-ink">{place}</h3>
            <span className="display mt-3 inline-block text-[18px] leading-10 tracking-[-0.5px] text-ink underline decoration-1 underline-offset-4 group-hover:decoration-2">
              See Edition →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
