import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import {
  api,
  formatDateRange,
  formatUsdc,
  hasFoundingPrice,
  nights,
  type Booking,
  type Trip,
} from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { BookingForm } from "@/components/BookingForm";
import { PaymentCheckout, type WidgetStage } from "@/components/PaymentCheckout";
import { UsdcCheckout, type UsdcStage } from "@/components/UsdcCheckout";
import { WaitScreen } from "@/components/WaitScreen";
import { photos, src, type Photo } from "@/lib/photos";
import { CONTRACT_URL } from "@/lib/faq";

const EDITION_PHOTO: Record<string, Photo> = {
  itamambuca: photos.itamambuca,
  "praia-do-rosa": photos.praiaDoRosa,
};

/** Group invite shown once the seat is confirmed; the button is hidden when unset. */
const TELEGRAM_URL: string | undefined =
  import.meta.env.VITE_TELEGRAM_INVITE_URL || undefined;

const CONTRACT_SHORT = "0x7e1b…bb3F";
const NETWORK = "Base Sepolia";

/**
 * One flow, four steps. `placing`/`matching` share the Matching step and
 * `pay`/`verifying` share the Pay step, but each gets its own screen.
 */
type Stage = "details" | "placing" | "matching" | "pay" | "verifying" | "done";

/** How the seat is paid: in local currency through the P2P widget, or USDC straight from the wallet. */
type Method = "local" | "usdc";

/** Steps per method. USDC has no matching — it is a direct transfer. */
const STEPS: Record<Method, { labels: string[]; of: Record<Stage, number> }> = {
  local: {
    labels: ["Details", "Matching", "Pay", "Done"],
    of: { details: 0, placing: 1, matching: 1, pay: 2, verifying: 2, done: 3 },
  },
  usdc: {
    labels: ["Details", "Pay", "Done"],
    of: { details: 0, placing: 1, matching: 1, pay: 1, verifying: 1, done: 2 },
  },
};

/**
 * Booking checkout — /trips/:tripId/book/:bookingId?
 *
 *   1 Details   two columns: form (or saved details + payment) left, order
 *               summary right.
 *   2 Matching  one centred column, a waiting screen. The widget is mounted
 *               but hidden — it keeps the order alive.
 *   3 Pay       one centred column: trip strip, then the widget alone
 *               (amount, QR, "I've sent"). Verifying shows a waiting screen.
 *   4 Done      one centred column: seat confirmed, next step, proof.
 *
 * Copy rule: each screen says what to do now and what is being paid for.
 * How the payment works is explained once, in <PaymentInfo>.
 *
 *   no bookingId  → registration form; on save we replace the URL with the
 *                   new booking id, so a refresh resumes at the details/review.
 *   bookingId     → pending: review + payment · confirmed: done.
 *
 * The tree below keeps every slot in a fixed position so the payment widget
 * is never remounted while the layout around it changes.
 */
export function Book() {
  const { tripId = "", bookingId } = useParams<{
    tripId: string;
    bookingId?: string;
  }>();
  const navigate = useNavigate();
  const { ready, authenticated, login } = usePrivy();
  const call = useApi();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(Boolean(bookingId));
  const [widgetStage, setWidgetStage] = useState<WidgetStage>("checkout");
  const [method, setMethod] = useState<Method>("local");
  const [usdcStage, setUsdcStage] = useState<UsdcStage | null>(null); // null = not on the USDC pay screen yet

  useEffect(() => {
    api<Trip>(`/api/trips/${tripId}`)
      .then(setTrip)
      .catch((e) => setError(e.message));
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

  const pending = booking?.status === "pending";
  const stage: Stage =
    booking?.status === "confirmed"
      ? "done"
      : pending && !editing && method === "usdc" && usdcStage
        ? usdcStage
        : pending && !editing && method === "local" && widgetStage !== "checkout"
          ? widgetStage === "done"
            ? "verifying" // order complete, booking confirmation in flight
            : widgetStage
          : "details";
  const review = stage === "details" && pending && !editing; // saved details + payment
  const twoCol = stage === "details";
  const waiting =
    stage === "placing" || stage === "matching" || stage === "verifying";

  const ok = Boolean(trip) && ready && authenticated && !loadingBooking && !error;

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      {/* header — full width, above everything */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10 xl:px-12">
        <Link to="/" className="text-xl font-extrabold tracking-tight">
          drift<span className="text-coral">.</span>
        </Link>
        <span className="label text-mute">Secure booking</span>
      </header>

      <div
        className={
          twoCol
            ? "flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)]"
            : "flex-1"
        }
      >
        {/* ── main column ─────────────────────────────────────────────── */}
        <div className="flex min-h-full flex-col">
          <div
            className={
              twoCol
                ? "mx-auto w-full max-w-2xl flex-1 px-6 pb-12 pt-4 sm:px-10 lg:ml-auto lg:mr-0 lg:max-w-[640px] lg:px-16 lg:pt-6"
                : "mx-auto w-full max-w-[560px] flex-1 px-6 pb-16 pt-4 sm:px-10 lg:pt-6"
            }
          >
            <Steps labels={STEPS[method].labels} current={STEPS[method].of[stage]} centered={!twoCol} />

            {/* mobile summary — details only */}
            {twoCol && trip && (
              <div className="mt-8 lg:hidden">
                <Summary trip={trip} booking={booking} compact />
              </div>
            )}

            <div className="mt-8">
              {error && !trip && (
                <p className="text-sm text-red-700">{error}</p>
              )}
              {!trip && !error && <p className="text-sm text-mute">Loading…</p>}

              {trip && !ready && <Quiet>Loading your session…</Quiet>}

              {trip && ready && !authenticated && (
                <section className="card-line p-6 sm:p-8">
                  <h2 className={sectionTitle}>Log in to reserve your seat</h2>
                  <p className="mt-2 text-sm text-mute">
                    Email or wallet. Nothing is held until you pay.
                  </p>
                  <button onClick={login} className="btn-primary mt-5">
                    Log in
                  </button>
                </section>
              )}

              {trip && ready && authenticated && loadingBooking && (
                <Quiet>Loading your booking…</Quiet>
              )}

              {trip &&
                ready &&
                authenticated &&
                !loadingBooking &&
                error &&
                bookingId && (
                  <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-800">
                    <p>
                      Couldn't load booking{" "}
                      <code className="label normal-case">{bookingId}</code>:{" "}
                      {error}
                    </p>
                    <button
                      onClick={() =>
                        navigate(`/trips/${tripId}/book`, { replace: true })
                      }
                      className="mt-3 underline"
                    >
                      Start again
                    </button>
                  </div>
                )}

              {/* 1 · DETAILS — form */}
              {ok && stage === "details" && !review && (
                <section>
                  <h2 className={sectionTitle}>Your details</h2>
                  <p className="mt-1 text-sm text-mute">Takes 2 minutes.</p>
                  <div className="mt-6">
                    <BookingForm
                      trip={trip!}
                      initial={booking}
                      onSaved={onSaved}
                      onCancel={booking ? () => setEditing(false) : back}
                      showSummary={false}
                    />
                  </div>
                </section>
              )}

              {/* 1 · DETAILS — review: what you told us */}
              {ok && review && booking && (
                <DetailsBox
                  booking={booking}
                  onChange={() => setEditing(true)}
                />
              )}

              {/* 2 · MATCHING / 3 · VERIFYING — waiting screens */}
              {ok && stage === "placing" && (
                <WaitScreen
                  title="Placing your order"
                  body="Confirm the transaction in your wallet."
                />
              )}
              {ok && stage === "matching" && (
                <WaitScreen
                  title="Finding your merchant"
                  body="Usually 2–3 minutes. Keep this tab open."
                />
              )}
              {ok && stage === "verifying" && method === "local" && (
                <WaitScreen
                  title="Verifying your payment"
                  body="Usually under a minute."
                />
              )}

              {/* 3 · PAY — the trip in one line */}
              {ok && stage === "pay" && trip && <PayStrip trip={trip} />}

              {/* review: how to pay */}
              {ok && review && (
                <div className="mt-10">
                  <h2 className={sectionTitle}>Payment</h2>
                  <MethodPicker value={method} onChange={setMethod} className="mt-5" />
                </div>
              )}

              {/* USDC: pay screen (single column) — the component covers pay + verifying */}
              {ok && booking && pending && !editing && trip && method === "usdc" && usdcStage && (
                <div className="mt-6">
                  <UsdcCheckout
                    booking={booking}
                    price={trip.price_usdc}
                    onStageChange={setUsdcStage}
                    onSuccess={(b) => setBooking(b)}
                  />
                  {usdcStage === "pay" && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={() => setUsdcStage(null)}
                        className="text-sm text-mute hover:text-ink"
                      >
                        ‹ Change payment method
                      </button>
                    </div>
                  )}
                </div>
              )}

              {ok && review && method === "usdc" && (
                <button
                  onClick={() => setUsdcStage("pay")}
                  className="btn-primary btn-lg mt-6 w-full"
                >
                  Continue with USDC
                </button>
              )}

              {/* the P2P widget — one slot, never remounted between stages */}
              {ok && booking && pending && !editing && trip && method === "local" && (
                <div className={stage === "pay" ? "checkout-pay mt-6" : review ? "mt-6" : ""}>
                  <div>
                    <PaymentCheckout
                      tripId={trip.id}
                      price={trip.price_usdc}
                      productName={trip.title}
                      booking={booking}
                      onSuccess={(b) => setBooking(b)}
                      onStageChange={setWidgetStage}
                      quiet={waiting}
                    />
                  </div>
                </div>
              )}

              {ok && review && (
                <div className="mt-10 border-t border-line pt-6">
                  <button
                    onClick={back}
                    className="text-sm text-mute hover:text-ink"
                  >
                    ‹ Back to the trip
                  </button>
                </div>
              )}

              {/* 4 · DONE */}
              {trip && ready && authenticated && booking && stage === "done" && (
                <Done trip={trip} booking={booking} />
              )}

              {trip &&
                ready &&
                authenticated &&
                booking &&
                booking.status !== "pending" &&
                booking.status !== "confirmed" && (
                  <section className="card-line p-6 sm:p-8">
                    <span className="chip chip-ghost">{booking.status}</span>
                    <p className="mt-4 text-2xl font-extrabold tracking-tight">
                      This booking is {booking.status}.
                    </p>
                    <Link
                      to={`/trips/${tripId}`}
                      className="btn-secondary mt-6"
                    >
                      Back to the trip
                    </Link>
                  </section>
                )}
            </div>

            {twoCol && (
              <footer className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6">
                <a
                  href="/code-of-conduct"
                  className="label text-mute hover:text-ink"
                >
                  Code of conduct
                </a>
                <a href="/terms" className="label text-mute hover:text-ink">
                  Terms
                </a>
              </footer>
            )}
          </div>
        </div>

        {/* ── right: order summary (details only) ─────────────────────── */}
        {twoCol && (
          <aside className="hidden bg-paper lg:block lg:border-l lg:border-line">
            <div className="sticky top-0 mr-auto max-w-[520px] px-12 py-10 xl:px-16">
              {trip ? (
                <Summary trip={trip} booking={booking} />
              ) : (
                <p className="text-sm text-mute">Loading…</p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

const sectionTitle = "text-xl font-semibold tracking-tight text-ink";

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-mute">{children}</p>;
}

/** The only stepper on the page (labels depend on the payment method). */
function Steps({
  labels,
  current,
  centered,
}: {
  labels: string[];
  current: number;
  centered: boolean;
}) {
  return (
    <ol
      className={`flex items-center gap-x-2 whitespace-nowrap text-sm sm:gap-x-3 ${
        centered ? "justify-center" : ""
      }`}
    >
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  done
                    ? "bg-forest text-paper"
                    : active
                      ? "bg-ink text-paper"
                      : "border border-line text-mute"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={
                  active
                    ? "font-semibold text-ink"
                    : done
                      ? "text-ink/70"
                      : "text-mute"
                }
              >
                {label}
              </span>
            </span>
            {i < labels.length - 1 && (
              <span aria-hidden className="h-px w-3 bg-line sm:w-5" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Local currency through the P2P widget, or USDC straight from the wallet. */
function MethodPicker({
  value,
  onChange,
  className = "",
}: {
  value: Method;
  onChange: (m: Method) => void;
  className?: string;
}) {
  const options: { key: Method; title: string; detail: string }[] = [
    { key: "local", title: "Local currency", detail: "PIX and more, through a verified merchant" },
    { key: "usdc", title: "USDC", detail: "From your wallet on Base" },
  ];
  return (
    <div role="radiogroup" className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.key)}
            className={`card-line px-5 py-4 text-left transition-colors ${
              on ? "border-ink" : "hover:border-mute"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  on ? "border-ink" : "border-line"
                }`}
              >
                {on && <span className="h-2 w-2 rounded-full bg-ink" />}
              </span>
              <span className="font-semibold text-ink">{o.title}</span>
            </span>
            <span className="mt-1 block pl-7 text-sm text-mute">{o.detail}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Pay step: the trip in one line, the widget does the rest. */
function PayStrip({ trip }: { trip: Trip }) {
  const [place, edition] = trip.title.split(" — ");
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4 text-sm">
      <span className="min-w-0 truncate font-semibold text-ink">
        {place}
        {edition && <span className="font-normal text-mute"> · {edition}</span>}
      </span>
      <span className="shrink-0 font-semibold text-ink">
        {formatUsdc(trip.price_usdc)} USDC
      </span>
    </div>
  );
}

/** Seat confirmed, the next step, and the proof of the transaction. */
function Done({ trip, booking }: { trip: Trip; booking: Booking }) {
  const [place] = trip.title.split(" — ");
  return (
    <div className="py-10 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-forest text-paper">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <p className="display mt-8 text-[clamp(2.25rem,4vw,3.25rem)]">
        Seat confirmed
      </p>
      <p className="mt-4 text-base text-ink/80">
        {place} · {formatDateRange(trip.starts_on, trip.ends_on)}
      </p>
      {booking.telegram && (
        <p className="mt-1 text-base text-mute">
          We'll reach you on Telegram @{booking.telegram}.
        </p>
      )}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {TELEGRAM_URL && (
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-primary btn-lg"
          >
            Join the trip's Telegram ↗
          </a>
        )}
        <Link
          to="/profile"
          className={TELEGRAM_URL ? "btn-secondary btn-lg" : "btn-primary btn-lg"}
        >
          See my booking
        </Link>
      </div>
      {/* proof of the transaction */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-line pt-6">
        <span className="label normal-case text-mute">Booking {booking.id}</span>
        <a
          href={CONTRACT_URL}
          target="_blank"
          rel="noreferrer"
          className="label text-mute hover:text-ink"
        >
          Contract {CONTRACT_SHORT} ↗
        </a>
        <span className="chip chip-ghost">{NETWORK}</span>
      </div>
    </div>
  );
}

/** The saved registration, with a Change link — shown above the payment. */
function DetailsBox({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: () => void;
}) {
  const level = booking.surf_level
    ? booking.surf_level.charAt(0).toUpperCase() + booking.surf_level.slice(1)
    : "—";
  const rows: [string, string][] = [
    ["Name", booking.full_name ?? "—"],
    ["Email", booking.email ?? "—"],
    ["Telegram", booking.telegram ? `@${booking.telegram}` : "—"],
    ["Country", booking.country ?? "—"],
    ["Surf level", level],
  ];
  return (
    <section className="overflow-hidden rounded-[15px] border border-line bg-white">
      {rows.map(([k, v], i) => (
        <div
          key={k}
          className={`flex items-baseline gap-4 px-5 py-3.5 text-sm ${i > 0 ? "border-t border-line" : ""}`}
        >
          <span className="w-24 shrink-0 text-mute">{k}</span>
          <span className="min-w-0 flex-1 truncate text-ink">{v}</span>
          {i === 0 && (
            <button
              onClick={onChange}
              className="shrink-0 text-sm text-ink underline-offset-4 hover:underline"
            >
              Change
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * The one place in the flow that explains how the payment works.
 * A link that opens a small dialog, so it never sits in the way.
 */
function PaymentInfo() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="text-sm text-mute underline underline-offset-4 hover:text-ink"
      >
        How payment works
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current.close()}
        className="card-line m-auto w-[calc(100%-3rem)] max-w-md p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="p-6 sm:p-8">
          <p className={sectionTitle}>How payment works</p>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink/80">
            <li>
              <span className="font-semibold text-ink">1 · You pay in your currency.</span>{" "}
              PIX today; more as merchant circles open.
            </li>
            <li>
              <span className="font-semibold text-ink">2 · A verified merchant converts it</span>{" "}
              to USDC and settles on {NETWORK}, straight to Drift's contract.
            </li>
            <li>
              <span className="font-semibold text-ink">3 · Your seat is confirmed</span>{" "}
              the moment the order completes.
            </li>
          </ol>
          <div className="mt-6 flex items-center justify-between">
            <a
              href={CONTRACT_URL}
              target="_blank"
              rel="noreferrer"
              className="label text-mute hover:text-ink"
            >
              Contract {CONTRACT_SHORT} ↗
            </a>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="btn-secondary btn-sm"
            >
              Got it
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Order summary: what you're buying and what it costs. */
function Summary({
  trip,
  booking,
  compact = false,
}: {
  trip: Trip;
  booking: Booking | null;
  compact?: boolean;
}) {
  const founding = hasFoundingPrice(trip);
  const photo = EDITION_PHOTO[trip.spot.slug] ?? photos.hero;
  const [place, edition] = trip.title.split(" — ");
  const paid = booking?.status === "confirmed";
  return (
    <div className={compact ? "card-line p-5" : ""}>
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <img
            src={src(photo, 240)}
            alt={photo.alt}
            className="h-16 w-16 rounded-[12px] object-cover"
          />
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-paper">
            1
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{place}</p>
          {edition && <p className="text-sm text-mute">{edition}</p>}
          <p className="mt-1 text-sm text-mute">
            {formatDateRange(trip.starts_on, trip.ends_on)} ·{" "}
            {nights(trip.starts_on, trip.ends_on)} nights
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-ink">
            {formatUsdc(trip.price_usdc)} USDC
          </p>
          {founding && (
            <p className="text-sm text-mute line-through">
              {formatUsdc(trip.price_full_usdc!)} USDC
            </p>
          )}
        </div>
      </div>

      {founding && (
        <div className="mt-4">
          <span className="chip chip-coral">
            Founding cohort · {trip.founding_seats} seats
          </span>
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
            <span className="text-lg font-semibold text-ink">
              {paid ? "Paid" : "Total"}
            </span>
            <span className="text-2xl font-bold tracking-tight text-ink">
              <span className="label mr-2 text-mute">USDC</span>
              {formatUsdc(trip.price_usdc)}
            </span>
          </div>
          <div className="mt-6">
            <PaymentInfo />
          </div>
        </>
      )}
      {compact && (
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-semibold">{paid ? "Paid" : "Total"}</span>
          <span className="text-lg font-bold">
            {formatUsdc(trip.price_usdc)} USDC
          </span>
        </div>
      )}
    </div>
  );
}
