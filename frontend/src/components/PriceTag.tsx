import { formatUsdc, hasFoundingPrice, type Trip } from '@/lib/api';

type PriceTrip = Pick<Trip, 'price_usdc' | 'price_full_usdc' | 'founding_seats'>;

/**
 * Current price with the regular price struck through and the founding-cohort
 * chip, so it reads as a limited launch price rather than a discount.
 *
 *   ~~1,200 USDC~~  from 900 USDC   [FOUNDING COHORT · 8 SEATS]
 */
export function PriceTag({
  trip,
  size = 'md',
  className = '',
}: {
  trip: PriceTrip;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const founding = hasFoundingPrice(trip);
  const cur = { sm: 'text-base', md: 'text-2xl', lg: 'text-3xl' }[size];
  const full = { sm: 'text-xs', md: 'text-sm', lg: 'text-sm' }[size];

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1.5 ${className}`}>
      {founding && (
        <s className={`${full} text-mute decoration-mute/70`} aria-label="regular price">
          {formatUsdc(trip.price_full_usdc!)} USDC
        </s>
      )}
      <span className={`${cur} font-bold tracking-tight text-ink`}>from {formatUsdc(trip.price_usdc)} USDC</span>
      {founding && <span className="chip chip-coral">Founding cohort · {trip.founding_seats ?? 0} seats</span>}
    </div>
  );
}
