import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { api, type Trip, type Booking } from '@/lib/api';
import { useApi } from '@/hooks/useApi';

export function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const { authenticated, login } = usePrivy();
  const call = useApi();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) api<Trip>(`/api/trips/${id}`).then(setTrip).catch((e) => setError(e.message));
  }, [id]);

  async function book() {
    if (!authenticated) return login();
    setBusy(true);
    setError(null);
    try {
      setBooking(await call<Booking>('/api/bookings', { method: 'POST', body: { trip_id: id, seats: 1 } }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !trip) return <p className="text-red-700">{error}</p>;
  if (!trip) return <p className="text-ocean-700">Loading…</p>;

  return (
    <article className="grid gap-8 md:grid-cols-[2fr_1fr]">
      <div>
        <div className="mb-6 aspect-[16/9] rounded-2xl bg-gradient-to-br from-ocean-300 to-ocean-700" />
        <p className="text-xs uppercase tracking-wide text-ocean-500">
          {trip.spot.name} · {trip.spot.city}, {trip.spot.state}
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{trip.title}</h1>
        <p className="mt-4 text-ocean-700">{trip.description}</p>
        <ul className="mt-6 flex flex-wrap gap-2">
          {trip.includes.map((i) => (
            <li key={i} className="rounded-full bg-sand-100 px-3 py-1 text-sm">
              {i}
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit rounded-2xl border border-sand-300/60 bg-white p-6">
        <p className="text-2xl font-semibold">{Number(trip.price_usdc).toLocaleString()} USDC</p>
        <p className="mt-1 text-sm text-ocean-700">
          {trip.starts_on} → {trip.ends_on}
        </p>
        <p className="mt-1 text-sm text-ocean-700">{trip.seats_left} seats left</p>
        {booking ? (
          <p className="mt-4 rounded-lg bg-ocean-50 p-3 text-sm text-ocean-700">
            Booking created ({booking.status}). Head to <strong>My bookings</strong> to pay.
          </p>
        ) : (
          <button
            onClick={book}
            disabled={busy || trip.seats_left <= 0}
            className="mt-4 w-full rounded-full bg-ocean-500 py-2.5 font-medium text-white hover:bg-ocean-700 disabled:opacity-50"
          >
            {authenticated ? (busy ? 'Booking…' : 'Reserve a spot') : 'Log in to book'}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </aside>
    </article>
  );
}
