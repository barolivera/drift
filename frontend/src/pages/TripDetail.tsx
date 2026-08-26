import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { api, type Trip, type Booking } from '@/lib/api';
import { PaymentCheckout } from '@/components/PaymentCheckout';
import { P2P } from '@/lib/p2p';

type Stage = 'idle' | 'checkout' | 'paid';

export function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const { ready, authenticated, login } = usePrivy();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) api<Trip>(`/api/trips/${id}`).then(setTrip).catch((e) => setError(e.message));
  }, [id]);

  if (error && !trip) return <p className="text-red-700">{error}</p>;
  if (!trip) return <p className="text-ocean-700">Loading…</p>;

  const soldOut = trip.seats_left <= 0;

  function bookNow() {
    if (!authenticated && !P2P.demo) return login();
    setStage('checkout');
  }

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

        {stage === 'idle' && (
          <button
            onClick={bookNow}
            disabled={!ready || soldOut}
            className="mt-4 w-full rounded-full bg-ocean-500 py-2.5 font-medium text-white hover:bg-ocean-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ocean-500"
          >
            {!ready ? 'Loading…' : soldOut ? 'Sold out' : authenticated || P2P.demo ? 'Book Now' : 'Log in to book'}
          </button>
        )}

        {stage === 'checkout' && (
          <div className="mt-4">
            <p className="mb-3 text-sm text-ocean-700">Pay with PIX — settled in USDC on Base.</p>
            <PaymentCheckout
              tripId={trip.id}
              price={trip.price_usdc}
              productName={trip.title}
              onSuccess={(b) => {
                setBooking(b);
                setStage('paid');
              }}
              onCancel={() => setStage('idle')}
            />
            <button onClick={() => setStage('idle')} className="mt-3 w-full text-sm text-ocean-500 hover:underline">
              Cancel
            </button>
          </div>
        )}

        {stage === 'paid' && booking && (
          <div className="mt-4 rounded-xl bg-ocean-50 p-4">
            <p className="text-lg font-semibold text-ocean-900">🏄 You're in!</p>
            <p className="mt-1 text-sm text-ocean-700">
              Booking <span className="font-mono">{booking.id.slice(0, 8)}</span> is{' '}
              <strong>{booking.status}</strong>. See you at {trip.spot.name} on {trip.starts_on}.
            </p>
            <Link to="/profile" className="mt-3 inline-block text-sm text-ocean-500 hover:underline">
              View my bookings →
            </Link>
          </div>
        )}
      </aside>
    </article>
  );
}
