import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useApi } from '@/hooks/useApi';
import type { Booking, Me } from '@/lib/api';

export function Profile() {
  const { ready, authenticated, login } = usePrivy();
  const call = useApi();
  const [me, setMe] = useState<Me | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    Promise.all([call<Me>('/api/auth/me'), call<Booking[]>('/api/bookings')])
      .then(([m, b]) => {
        setMe(m);
        setBookings(b);
      })
      .catch((e) => setError(e.message));
  }, [ready, authenticated, call]);

  if (!ready) return <p className="text-ocean-700">Loading…</p>;
  if (!authenticated) {
    return (
      <div className="text-center">
        <p className="text-ocean-700">Log in to see your bookings.</p>
        <button onClick={login} className="mt-4 rounded-full bg-ocean-500 px-5 py-2 text-white">
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-sand-300/60 bg-white p-6">
        <h2 className="text-lg font-semibold">{me?.display_name ?? me?.email ?? 'Nomad'}</h2>
        <p className="font-mono text-xs text-ocean-700">{me?.wallet_address ?? 'no wallet linked'}</p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">My bookings</h2>
        {error && <p className="text-red-700">{error}</p>}
        {bookings.length === 0 ? (
          <p className="text-ocean-700">No bookings yet.</p>
        ) : (
          <ul className="divide-y divide-sand-300/60 rounded-2xl border border-sand-300/60 bg-white">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{b.title}</p>
                  <p className="text-sm text-ocean-700">
                    {b.spot.name} · {b.starts_on} → {b.ends_on}
                  </p>
                </div>
                <span className="rounded-full bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide">{b.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
