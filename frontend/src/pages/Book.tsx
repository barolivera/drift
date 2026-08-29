import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { api, formatDateRange, formatUsdc, hasFoundingPrice, type Booking, type Trip } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { BookingForm } from '@/components/BookingForm';
import { PaymentCheckout } from '@/components/PaymentCheckout';

/**
 * Standalone booking page — /trips/:tripId/book/:bookingId?
 *
 *   no bookingId  → registration form; on save we navigate (replace) to the
 *                   URL with the new booking id, so a refresh resumes here.
 *   bookingId     → pending: p2pkit checkout · confirmed: "You're in!"
 *
 * Deliberately quiet: one column, no photography, no line icons. Labels and
 * identifiers in Geist Pixel; the only solid colour is the action button.
 */
export function Book() {
  const { tripId = '', bookingId } = useParams<{ tripId: string; bookingId?: string }>();
  const navigate = useNavigate();
  const { ready, authenticated, login } = usePrivy();
  const call = useApi();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(Boolean(bookingId));

  useEffect(() => {
    api<Trip>(`/api/trips/${tripId}`).then(setTrip).catch((e) => setError(e.message));
  }, [tripId]);

  // Resume from the URL (refresh / back navigation).
  useEffect(() => {
    if (!bookingId || !ready || !authenticated) {
      if (!bookingId) setLoadingBooking(false);
      return;
    }
    let cancelled = false;
    setLoadingBooking(true);
    call<Booking>(`/api/bookings/${bookingId}`)
      .then((b) => {
        if (cancelled) return;
        if (b.trip_id !== tripId) {
          navigate(`/trips/${b.trip_id}/book/${b.id}`, { replace: true });
          return;
        }
        setBooking(b);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingBooking(false));
    return () => {
      cancelled = true;
    };
  }, [bookingId, ready, authenticated, tripId, call, navigate]);

  const onSaved = useCallback(
    (b: Booking) => {
      setBooking(b);
      navigate(`/trips/${tripId}/book/${b.id}`, { replace: true });
    },
    [navigate, tripId],
  );

  const back = () => navigate(`/trips/${tripId}`);

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <header className="bg-paper">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-5">
          <Link to="/" className="text-xl font-extrabold tracking-tight">
            drift<span className="text-coral">.</span>
          </Link>
          <span className="label text-mute">Secure booking</span>
        </div>
        <div className="mx-auto h-px max-w-2xl bg-line/70" />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:py-14">
        {error && !trip && <p className="text-sm text-red-700">{error}</p>}
        {!trip && !error && <p className="text-sm text-mute">Loading…</p>}

        {trip && (
          <>
            <Summary trip={trip} booking={booking} />

            {!ready && <Quiet>Loading your session…</Quiet>}

            {ready && !authenticated && (
              <div className="card mt-8 p-6">
                <p className="text-sm text-ink/80">Log in to reserve your seat.</p>
                <button onClick={login} className="btn-primary mt-4">
                  Log in
                </button>
              </div>
            )}

            {ready && authenticated && loadingBooking && <Quiet>Loading your booking…</Quiet>}

            {ready && authenticated && !loadingBooking && error && bookingId && (
              <div className="mt-8 rounded-2xl bg-red-50 p-6 text-sm text-red-800">
                <p>
                  Couldn't load booking <code className="label normal-case">{bookingId}</code>: {error}
                </p>
                <button onClick={() => navigate(`/trips/${tripId}/book`, { replace: true })} className="mt-3 underline">
                  Start again
                </button>
              </div>
            )}

            {ready && authenticated && !loadingBooking && !booking && !error && (
              <section className="card mt-8 p-6 sm:p-8">
                <p className="label text-mute">Step 1 of 2</p>
                <h2 className="mt-2 text-xl font-bold tracking-tight">Your details</h2>
                <p className="mt-1 text-sm text-mute">Two minutes. Then you pay and the seat is yours.</p>
                <div className="mt-6">
                  <BookingForm trip={trip} onSaved={onSaved} onCancel={back} showSummary={false} />
                </div>
              </section>
            )}

            {ready && authenticated && booking && booking.status === 'pending' && (
              <section className="card mt-8 p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <p className="label text-mute">Step 2 of 2</p>
                  <span className="chip chip-mustard">Pending</span>
                </div>
                <h2 className="mt-2 text-xl font-bold tracking-tight">Payment</h2>
                <p className="mt-1 text-sm text-mute">
                  Pay in your currency. A P2P merchant settles USDC to Drift's contract on Base.
                </p>
                <div className="mt-6">
                  <PaymentCheckout
                    tripId={trip.id}
                    price={trip.price_usdc}
                    productName={trip.title}
                    booking={booking}
                    onSuccess={(b) => setBooking(b)}
                  />
                </div>
                <button onClick={back} className="mt-6 text-sm text-mute underline-offset-4 hover:text-ink hover:underline">
                  Cancel and go back to the trip
                </button>
              </section>
            )}

            {ready && authenticated && booking && booking.status !== 'pending' && (
              <section className="card mt-8 p-6 sm:p-8">
                {booking.status === 'confirmed' ? (
                  <>
                    <span className="chip chip-forest">Confirmed</span>
                    <p className="mt-4 text-3xl font-extrabold tracking-tight">You're in.</p>
                    <p className="mt-2 text-ink/80">
                      Your seat at {trip.spot.name} is confirmed. We'll reach you on Telegram before you land.
                    </p>
                    <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
                      <dt className="label text-mute">booking</dt>
                      <dd className="label normal-case text-ink">{booking.id}</dd>
                      <dt className="label text-mute">status</dt>
                      <dd className="label text-ink">{booking.status}</dd>
                      <dt className="label text-mute">dates</dt>
                      <dd className="label text-ink">
                        {trip.starts_on} → {trip.ends_on}
                      </dd>
                    </dl>
                    <Link to="/profile" className="btn-primary mt-8">
                      Go to my bookings →
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="chip chip-ghost">{booking.status}</span>
                    <p className="mt-4 text-2xl font-extrabold tracking-tight">This booking is {booking.status}.</p>
                    <Link to={`/trips/${tripId}`} className="btn-secondary mt-6">
                      Back to the trip
                    </Link>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto w-full max-w-2xl px-5 py-6">
        <span className="label text-mute">Drift · payments settle on Base via P2P.me · contract 0x7e1b…bb3F</span>
      </footer>
    </div>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 text-sm text-mute">{children}</p>;
}

function Summary({ trip, booking }: { trip: Trip; booking: Booking | null }) {
  const founding = hasFoundingPrice(trip);
  return (
    <section>
      <p className="label text-mute">{booking ? `Booking ${booking.id.slice(0, 8)}` : 'New booking'}</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{trip.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="chip chip-lilac">{formatDateRange(trip.starts_on, trip.ends_on)}</span>
        <span className="chip chip-ghost">{trip.location ?? `${trip.spot.name}, ${trip.spot.state}`}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-2">
        <span className="label text-mute">Price</span>
        {founding && <s className="text-sm text-mute">{formatUsdc(trip.price_full_usdc!)} USDC</s>}
        <span className="text-lg font-bold">{formatUsdc(trip.price_usdc)} USDC</span>
        {founding && <span className="chip chip-coral">Founding cohort · {trip.founding_seats} seats</span>}
      </div>
    </section>
  );
}
