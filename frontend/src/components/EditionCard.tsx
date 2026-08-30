import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatDateRange, type Trip } from '@/lib/api';
import { photos, src, type Photo } from '@/lib/photos';
import { ditherReveal } from '@/lib/dither';

/**
 * Edition artwork (public/images/editions): the dithered version sits on top
 * of the real photo and dissolves away on hover (see .dither-layer in index.css).
 */
const ART: Record<string, { dither: string; photo: string; alt: string }> = {
  itamambuca: { dither: '/images/editions/itamambuca.png', photo: '/images/editions/itamambuca-photo.jpg', alt: photos.itamambuca.alt },
  'praia-do-rosa': { dither: '/images/editions/praia-do-rosa.png', photo: '/images/editions/praia-do-rosa-photo.jpg', alt: photos.praiaDoRosa.alt },
};
const fallback = (photo: Photo) => ({ dither: src(photo, 900), photo: src(photo, 900), alt: photo.alt });

/**
 * Edition card: a square photo inset in a soft card, a dashed rule, then the
 * dates, the place in Geist Pixel and "See Edition". No price, no seat count
 * here — the edition page carries them. The whole card is a link.
 */
export function EditionCard({ trip, className = 'w-full max-w-[415px]' }: { trip: Trip; className?: string }) {
  const art = ART[trip.spot.slug] ?? fallback(photos.hero);
  const [place] = trip.title.split(' — ');
  const dither = useRef<HTMLImageElement>(null);
  const reveal = (on: boolean) => dither.current && ditherReveal(dither.current, on);
  return (
    <Link
      to={`/trips/${trip.id}`}
      className={`group block transition hover:-translate-y-0.5 ${className}`}
      onMouseEnter={() => reveal(true)}
      onMouseLeave={() => reveal(false)}
      onFocus={() => reveal(true)}
      onBlur={() => reveal(false)}
    >
      <div className="rounded-t-[12px] rounded-b-[24px] bg-surface-3">
        <div className="p-6">
          <div className="relative aspect-square overflow-hidden rounded-[8px]">
            <img src={art.photo} alt={art.alt} className="absolute inset-0 h-full w-full object-cover" />
            <img ref={dither} src={art.dither} alt="" aria-hidden className="dither-layer absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
        <div aria-hidden className="mx-[11%] border-t border-dashed border-[#bfbfba]" />
        <div className="flex flex-col gap-7 py-5 pl-6 pr-[18px]">
          <p className="flex items-center gap-2.5 text-[15px] font-semibold uppercase tracking-[0.8px] text-ink">
            <img src="/images/marks/calendar.svg" alt="" width={20} height={20} className="h-5 w-5" />
            {formatDateRange(trip.starts_on, trip.ends_on)}
          </p>
          <div>
            <h3 className="display text-[2rem] leading-10 tracking-[-0.5px] text-ink">{place}</h3>
            <span className="display inline-block text-base leading-10 tracking-[-0.5px] text-ink underline decoration-1 underline-offset-4 group-hover:decoration-2">
              See Edition →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
