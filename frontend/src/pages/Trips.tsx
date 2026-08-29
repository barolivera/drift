import { useEffect, useState } from 'react';
import { api, type Trip } from '@/lib/api';
import { EditionCard } from '@/components/EditionCard';
import { ui } from '@/lib/ui';

export function Trips() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Trip[]>('/api/trips').then(setTrips).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!trips) return <p className="text-mute">Loading…</p>;
  if (trips.length === 0) return <p className="text-mute">No upcoming trips yet.</p>;

  return (
    <div>
      <h1 className={ui.h1}>Pick your water</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-2 md:gap-8">
        {trips.map((t) => (
          <EditionCard key={t.id} trip={t} />
        ))}
      </div>
    </div>
  );
}
