import { Link } from 'react-router-dom';
import { formatDateRange, nights, type Trip } from '@/lib/api';
import { PriceTag } from '@/components/PriceTag';

export function TripCard({ trip }: { trip: Trip }) {
  const soldOut = trip.seats_left <= 0;
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group block overflow-hidden rounded-2xl border border-sand-300/60 bg-white transition hover:shadow-lg"
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-ocean-300 to-ocean-700" />
      <div className="space-y-2 p-4">
        <div className="text-xs uppercase tracking-wide text-ocean-500">
          {trip.location ?? `${trip.spot.name} · ${trip.spot.state}`}
        </div>
        <h3 className="font-semibold group-hover:text-ocean-500">{trip.title}</h3>
        {trip.description && <p className="line-clamp-2 text-sm text-ocean-700">{trip.description}</p>}
        <div className="flex items-center justify-between text-sm text-ocean-700">
          <span>
            {formatDateRange(trip.starts_on, trip.ends_on)} · {nights(trip.starts_on, trip.ends_on)} nights
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <PriceTag trip={trip} size="sm" />
          <span className={`text-xs ${soldOut ? 'text-red-700' : 'text-ocean-700'}`}>
            {soldOut ? 'Sold out' : `${trip.seats_left} of ${trip.capacity} seats left`}
          </span>
        </div>
      </div>
    </Link>
  );
}
