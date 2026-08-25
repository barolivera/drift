import { Link } from 'react-router-dom';
import type { Trip } from '@/lib/api';

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group block overflow-hidden rounded-2xl border border-sand-300/60 bg-white transition hover:shadow-lg"
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-ocean-300 to-ocean-700" />
      <div className="space-y-2 p-4">
        <div className="text-xs uppercase tracking-wide text-ocean-500">
          {trip.spot.name} · {trip.spot.state}
        </div>
        <h3 className="font-semibold group-hover:text-ocean-500">{trip.title}</h3>
        <div className="flex items-center justify-between text-sm text-ocean-700">
          <span>
            {trip.starts_on} → {trip.ends_on}
          </span>
          <span className="font-medium text-ocean-900">{Number(trip.price_usdc).toLocaleString()} USDC</span>
        </div>
        <div className="text-xs text-ocean-700">
          {trip.seats_left} seats left · {trip.level}
        </div>
      </div>
    </Link>
  );
}
