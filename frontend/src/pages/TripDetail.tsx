import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { api, formatDateRange, formatPrice, nights, type Trip, type Booking } from '@/lib/api';
import { PaymentCheckout } from '@/components/PaymentCheckout';
import { BookingForm } from '@/components/BookingForm';

type Stage = 'idle' | 'form' | 'checkout' | 'paid';

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
  const paragraphs = (trip.description_long ?? trip.description ?? '').split(/\n\s*\n/).filter(Boolean);

  function bookNow() {
    if (!authenticated) return login();
    setStage('form');
  }

  return (
    <article className="grid gap-8 md:grid-cols-[2fr_1fr]">
      {/* ── main column ─────────────────────────────────────────── */}
      <div className="space-y-10">
        <header>
          <div className="mb-6 aspect-[16/9] rounded-2xl bg-gradient-to-br from-ocean-300 to-ocean-700" />
          <p className="text-xs uppercase tracking-wide text-ocean-500">
            {trip.location ?? `${trip.spot.name} · ${trip.spot.city}, ${trip.spot.state}`}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{trip.title}</h1>
          <p className="mt-1 text-sm text-ocean-700">
            {formatDateRange(trip.starts_on, trip.ends_on)} · {nights(trip.starts_on, trip.ends_on)} nights ·{' '}
            {trip.capacity} seats
          </p>
          <div className="mt-5 space-y-4 text-ocean-800">
            {paragraphs.map((para, i) => (
              <p key={i} className={i === 0 ? 'text-lg leading-relaxed' : 'leading-relaxed'}>
                {para}
              </p>
            ))}
          </div>
        </header>

        {(trip.included.length > 0 || trip.not_included.length > 0) && (
          <section className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ocean-500">What's included</h2>
              <ul className="space-y-2">
                {trip.included.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-ocean-800">
                    <span aria-hidden className="mt-0.5 text-ocean-500">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ocean-500">Not included</h2>
              <ul className="space-y-2">
                {trip.not_included.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-ocean-700">
                    <span aria-hidden className="mt-0.5 text-sand-500">–</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {trip.daily_schedule.length > 0 && (
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ocean-500">A day at the house</h2>
            <p className="mb-5 text-sm text-ocean-700">Same rhythm every day. The deep-work block is the one rule.</p>
            <ol className="relative border-l border-sand-300 pl-6">
              {trip.daily_schedule.map((slot) => (
                <li key={slot.time} className="relative pb-6 last:pb-0">
                  <span
                    aria-hidden
                    className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-sand-50 ${
                      slot.highlight ? 'bg-ocean-500' : 'bg-sand-300'
                    }`}
                  />
                  <div className={slot.highlight ? '-ml-3 rounded-xl border border-ocean-300 bg-ocean-50 px-4 py-3' : ''}>
                    <div className="flex items-baseline gap-3">
                      <span className="w-12 shrink-0 font-mono text-xs text-ocean-500">{slot.time}</span>
                      <span className={`font-semibold ${slot.highlight ? 'text-ocean-900' : 'text-ocean-800'}`}>
                        {slot.title}
                      </span>
                      {slot.highlight && (
                        <span className="rounded-full bg-ocean-500 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                          The one rule
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 pl-[3.75rem] text-sm text-ocean-700">{slot.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {trip.who_its_for && (
          <section className="rounded-2xl bg-sand-100 p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ocean-500">Who it's for</h2>
            <p className="leading-relaxed text-ocean-800">{trip.who_its_for}</p>
          </section>
        )}
      </div>

      {/* ── booking card ────────────────────────────────────────── */}
      <aside
        className={`h-fit rounded-2xl border border-sand-300/60 bg-white p-6 ${
          stage === 'idle' || stage === 'paid' ? 'md:sticky md:top-6' : ''
        }`}
      >
        <p className="text-2xl font-semibold">{formatPrice(trip.price_usdc)}</p>
        <p className="mt-1 text-sm text-ocean-700">{formatDateRange(trip.starts_on, trip.ends_on)}</p>
        <p className={`mt-1 text-sm ${soldOut ? 'text-red-700' : 'text-ocean-700'}`}>
          {soldOut ? 'Sold out' : `${trip.seats_left} of ${trip.capacity} seats left`}
        </p>

        {stage === 'idle' && (
          <button
            onClick={bookNow}
            disabled={!ready || soldOut}
            className="mt-4 w-full rounded-full bg-ocean-500 py-2.5 font-medium text-white hover:bg-ocean-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ocean-500"
          >
            {!ready ? 'Loading…' : soldOut ? 'Sold out' : authenticated ? 'Book Now' : 'Log in to book'}
          </button>
        )}

        {stage === 'form' && (
          <div className="mt-4">
            <BookingForm
              trip={trip}
              onSaved={(b) => {
                setBooking(b);
                setStage('checkout');
              }}
              onCancel={() => setStage('idle')}
            />
          </div>
        )}

        {stage === 'checkout' && booking && (
          <div className="mt-4">
            <p className="mb-3 text-sm text-ocean-700">Pay with PIX — settled in USDC on Base.</p>
            <PaymentCheckout
              tripId={trip.id}
              price={trip.price_usdc}
              productName={trip.title}
              booking={booking}
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
