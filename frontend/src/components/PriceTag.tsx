import { formatUsdc, hasFoundingPrice, type Trip } from '@/lib/api';

type PriceTrip = Pick<Trip, 'price_usdc' | 'price_full_usdc' | 'founding_seats'>;

/**
 * Current price with the regular price struck through and the founding-cohort
 * label, so it reads as a limited launch price rather than a discount.
 *
 *   ~~1,200 USDC~~  from 900 USDC   [Founding cohort · 8 seats]
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
  const cur = {
    sm: 'text-base',
    md: 'text-2xl',
    lg: 'font-display text-lg',
  }[size];
  const full = { sm: 'text-xs', md: 'text-sm', lg: 'text-sm' }[size];

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      {founding && (
        <s className={`${full} text-ocean-700/70 decoration-ocean-700/60`} aria-label="regular price">
          {formatUsdc(trip.price_full_usdc!)} USDC
        </s>
      )}
      <span className={`${cur} font-semibold text-ocean-900`}>
        from {formatUsdc(trip.price_usdc)} USDC
      </span>
      {founding && (
        <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-coral">
          Founding cohort · {trip.founding_seats ?? 0} seats
        </span>
      )}
    </div>
  );
}
