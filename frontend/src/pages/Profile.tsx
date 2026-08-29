import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useApi } from '@/hooks/useApi';
import type { Booking, Me } from '@/lib/api';

const STATUS_CHIP: Record<string, string> = {
  confirmed: 'chip chip-forest',
  pending: 'chip chip-mustard',
  cancelled: 'chip chip-ghost',
};

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

  if (!ready) return <p className="text-mute">Loading…</p>;
  if (!authenticated) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-mute">Log in to see your bookings.</p>
        <button onClick={login} className="btn-primary mt-5">
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="card p-6 sm:p-8">
        <p className="label text-mute">Account</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{me?.display_name ?? me?.email ?? 'Nomad'}</h1>
        <p className="label mt-3 text-mute">{me?.wallet_address ?? 'no wallet linked'}</p>
      </section>
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold tracking-tight">My bookings</h2>
          <Link to="/trips" className="btn-secondary btn-sm">
            Browse trips
          </Link>
        </div>
        {error && <p className="text-red-700">{error}</p>}
        {bookings.length === 0 ? (
          <p className="text-mute">No bookings yet.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-semibold">{b.title}</p>
                  <p className="mt-1 text-sm text-mute">{b.spot.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="chip chip-lilac">
                      {b.starts_on} → {b.ends_on}
                    </span>
                    <span className="label self-center text-mute">{b.id.slice(0, 8)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={STATUS_CHIP[b.status] ?? 'chip chip-ghost'}>{b.status}</span>
                  {b.status === 'pending' && (
                    <Link to={`/trips/${b.trip_id}/book/${b.id}`} className="btn-primary btn-sm">
                      Pay now
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
