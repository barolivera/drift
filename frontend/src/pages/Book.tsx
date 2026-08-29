import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { api, formatDateRange, formatUsdc, hasFoundingPrice, nights, type Booking, type Trip } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { BookingForm } from '@/components/BookingForm';
import { PaymentCheckout } from '@/components/PaymentCheckout';
import { photos, src, type Photo } from '@/lib/photos';
import { CONTRACT_URL } from '@/lib/faq';

const EDITION_PHOTO: Record<string, Photo> = { itamambuca: photos.itamambuca, 'praia-do-rosa': photos.praiaDoRosa };

type Step = 'details' | 'payment' | 'confirmation';

/**
 * Booking checkout — /trips/:tripId/book/:bookingId?
 *
 * Two columns, checkout-style: the left column walks through
 * Details → Payment → Confirmation; the right column is the order summary
 * on a surface background and stays put while you scroll.
 *
 *   no bookingId  → registration form; on save we replace the URL with the
 *                   new booking id, so a refresh resumes at the payment step.
 *   bookingId     → pending: details box (Change) + p2pkit checkout
 *                   confirmed: "You're in."
 */
export function Book() {
  const { tripId = '', bookingId } = useParams<{ tripId: string; bookingId?: string }>();
  const navigate = useNavigate();
  const { ready, authenticated, login } = usePrivy();
  const call = useApi();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [editing, setEditing] = useState(false);
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
      setEditing(false);
      navigate(`/trips/${tripId}/book/${b.id}`, { replace: true });
    },
    [navigate, tripId],
  );

  const back = () => navigate(`/trips/${tripId}`);
  const step: Step = booking?.status === 'confirmed' ? 'confirmation' : booking && !editing ? 'payment' : 'details';

  return (
    <div className="min-h-full bg-paper text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)]">
      {/* ── left: the steps ─────────────────────────────────────────── */}
      <div className="flex min-h-full flex-col">
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-12 pt-8 sm:px-10 lg:ml-auto lg:mr-0 lg:max-w-[640px] lg:px-16 lg:pt-12">
          <header className="flex items-center justify-between">
            <Link to="/" className="text-xl font-extrabold tracking-tight">
              drift<span className="text-coral">.</span>
            </Link>
            <span className="label text-mute">Secure booking</span>
          </header>
          <Steps current={step} />

          {/* mobile summary */}
          {trip && (
            <div className="mt-8 lg:hidden">
              <Summary trip={trip} booking={booking} compact />
            </div>
          )}

          <div className="mt-8">
            {error && !trip && <p className="text-sm text-red-700">{error}</p>}
            {!trip && !error && <p className="text-sm text-mute">Loading…</p>}

            {trip && !ready && <Quiet>Loading your session…</Quiet>}

            {trip && ready && !authenticated && (
              <section className="card p-6 sm:p-8">
                <h2 className={sectionTitle}>Log in to reserve your seat</h2>
                <p className="mt-2 text-sm text-mute">Email or wallet — it takes a few seconds and holds nothing until you pay.</p>
                <button onClick={login} className="btn-primary mt-5">
                  Log in
                </button>
              </section>
            )}

            {trip && ready && authenticated && loadingBooking && <Quiet>Loading your booking…</Quiet>}

            {trip && ready && authenticated && !loadingBooking && error && bookingId && (
              <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-800">
                <p>
                  Couldn't load booking <code className="label normal-case">{bookingId}</code>: {error}
                </p>
                <button onClick={() => navigate(`/trips/${tripId}/book`, { replace: true })} className="mt-3 underline">
                  Start again
                </button>
              </div>
            )}

            {/* 1 · DETAILS */}
            {trip && ready && authenticated && !loadingBooking && !error && step === 'details' && (
              <section>
                <h2 className={sectionTitle}>Your details</h2>
                <p className="mt-1 text-sm text-mute">Two minutes. Then you pay and the seat is yours.</p>
                <div className="mt-6">
                  <BookingForm
                    trip={trip}
                    initial={booking}
                    onSaved={onSaved}
                    onCancel={booking ? () => setEditing(false) : back}
                    showSummary={false}
                  />
                </div>
              </section>
            )}

            {/* 2 · PAYMENT */}
            {trip && ready && authenticated && booking && step === 'payment' && (
              <>
                <DetailsBox booking={booking} onChange={() => setEditing(true)} />
                <section className="mt-10">
                  <h2 className={sectionTitle}>Payment</h2>
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
                </section>
                <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
                  <button onClick={back} className="text-sm text-mute hover:text-ink">
                    ‹ Back to the trip
                  </button>
                  <span className="label text-mute">Seat held while you pay</span>
                </div>
              </>
            )}

            {/* 3 · CONFIRMATION */}
            {trip && ready && authenticated && booking && step === 'confirmation' && (
              <section className="card p-6 sm:p-8">
                <span className="chip chip-forest">Confirmed</span>
                <p className="display mt-5 text-[clamp(2rem,3.6vw,3rem)]">You're in.</p>
                <p className="mt-3 text-ink/80">
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
              </section>
            )}

            {trip && ready && authenticated && booking && booking.status !== 'pending' && booking.status !== 'confirmed' && (
              <section className="card p-6 sm:p-8">
                <span className="chip chip-ghost">{booking.status}</span>
                <p className="mt-4 text-2xl font-extrabold tracking-tight">This booking is {booking.status}.</p>
                <Link to={`/trips/${tripId}`} className="btn-secondary mt-6">
                  Back to the trip
                </Link>
              </section>
            )}
          </div>

          <footer className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6">
            <a href="/code-of-conduct" className="label text-mute hover:text-ink">Code of conduct</a>
            <a href="/terms" className="label text-mute hover:text-ink">Terms</a>
            <a href={CONTRACT_URL} target="_blank" rel="noreferrer" className="label text-mute hover:text-ink">
              Contract 0x7e1b…bb3F ↗
            </a>
          </footer>
        </div>
      </div>

      {/* ── right: order summary ─────────────────────────────────────── */}
      <aside className="hidden bg-surface lg:block">
        <div className="sticky top-0 mr-auto max-w-[520px] px-12 py-12 xl:px-16">
          {trip ? <Summary trip={trip} booking={booking} /> : <p className="text-sm text-mute">Loading…</p>}
        </div>
      </aside>
    </div>
  );
}

const sectionTitle = 'text-xl font-semibold tracking-tight text-ink';

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-mute">{children}</p>;
}

/** Details › Payment › Confirmation */
function Steps({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'payment', label: 'Payment' },
    { key: 'confirmation', label: 'Confirmation' },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className={i === idx ? 'font-semibold text-ink' : i < idx ? 'text-ink/70' : 'text-mute'}>{s.label}</span>
          {i < steps.length - 1 && <span aria-hidden className="text-mute">›</span>}
        </li>
      ))}
    </ol>
  );
}

/** The saved registration, with a Change link — shown above the payment step. */
function DetailsBox({ booking, onChange }: { booking: Booking; onChange: () => void }) {
  const level = booking.surf_level ? booking.surf_level.charAt(0).toUpperCase() + booking.surf_level.slice(1) : '—';
  const rows: [string, string][] = [
    ['Name', booking.full_name ?? '—'],
    ['Email', booking.email ?? '—'],
    ['Telegram', booking.telegram ? `@${booking.telegram}` : '—'],
    ['Country', booking.country ?? '—'],
    ['Surf level', level],
  ];
  return (
    <section className="overflow-hidden rounded-[15px] border border-line">
      {rows.map(([k, v], i) => (
        <div key={k} className={`flex items-baseline gap-4 px-5 py-3.5 text-sm ${i > 0 ? 'border-t border-line' : ''}`}>
          <span className="w-24 shrink-0 text-mute">{k}</span>
          <span className="min-w-0 flex-1 truncate text-ink">{v}</span>
          {i === 0 && (
            <button onClick={onChange} className="shrink-0 text-sm text-ink underline-offset-4 hover:underline">
              Change
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

/** Order summary: what you're buying, what it costs, how it's paid. */
function Summary({ trip, booking, compact = false }: { trip: Trip; booking: Booking | null; compact?: boolean }) {
  const founding = hasFoundingPrice(trip);
  const photo = EDITION_PHOTO[trip.spot.slug] ?? photos.hero;
  const [place, edition] = trip.title.split(' — ');
  const paid = booking?.status === 'confirmed';
  return (
    <div className={compact ? 'card p-5' : ''}>
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <img src={src(photo, 240)} alt={photo.alt} className="h-16 w-16 rounded-[12px] object-cover" />
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-paper">1</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{place}</p>
          {edition && <p className="text-sm text-mute">{edition}</p>}
          <p className="mt-1 text-sm text-mute">
            {formatDateRange(trip.starts_on, trip.ends_on)} · {nights(trip.starts_on, trip.ends_on)} nights
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-ink">{formatUsdc(trip.price_usdc)} USDC</p>
          {founding && <p className="text-sm text-mute line-through">{formatUsdc(trip.price_full_usdc!)} USDC</p>}
        </div>
      </div>

      {founding && (
        <div className="mt-4">
          <span className="chip chip-coral">Founding cohort · {trip.founding_seats} seats</span>
        </div>
      )}

      {!compact && (
        <>
          <dl className="mt-6 space-y-2 border-t border-line pt-6 text-sm">
            <div className="flex justify-between">
              <dt className="text-mute">Seat</dt>
              <dd className="text-ink">{formatUsdc(trip.price_usdc)} USDC</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-mute">Fees</dt>
              <dd className="text-ink">None</dd>
            </div>
          </dl>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-6">
            <span className="text-lg font-semibold text-ink">{paid ? 'Paid' : 'Total'}</span>
            <span className="text-2xl font-bold tracking-tight text-ink">
              <span className="label mr-2 text-mute">USDC</span>
              {formatUsdc(trip.price_usdc)}
            </span>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-mute">
            You pay in your own currency (PIX, and more as P2P.me opens merchant circles). A verified merchant
            converts it and the USDC settles on Base, straight to Drift's contract. Your seat is confirmed the
            moment the order completes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="chip chip-forest">0x7e1b…bb3F</span>
            <span className="chip chip-ghost">Base Sepolia</span>
            {paid && <span className="chip chip-forest">Confirmed</span>}
          </div>
        </>
      )}
      {compact && (
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-semibold">{paid ? 'Paid' : 'Total'}</span>
          <span className="text-lg font-bold">{formatUsdc(trip.price_usdc)} USDC</span>
        </div>
      )}
    </div>
  );
}
