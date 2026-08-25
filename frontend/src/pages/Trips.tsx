import { useEffect, useState } from 'react';
import { api, type Trip } from '@/lib/api';
import { TripCard } from '@/components/TripCard';

export function Trips() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Trip[]>('/api/trips').then(setTrips).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!trips) return <p className="text-ocean-700">Loading…</p>;
  if (trips.length === 0) return <p className="text-ocean-700">No upcoming trips yet.</p>;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((t) => (
        <TripCard key={t.id} trip={t} />
      ))}
    </div>
  );
}
