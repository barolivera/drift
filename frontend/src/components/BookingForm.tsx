import { useMemo, useState, type FormEvent } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ApiError, formatDateRange, type Booking, type BookingInput, type Trip } from '@/lib/api';
import { PriceTag } from '@/components/PriceTag';
import { useApi } from '@/hooks/useApi';

export interface BookingFormProps {
  trip: Trip;
  /** Called with the pending booking once it is saved — hand it to <PaymentCheckout>. */
  onSaved: (booking: Booking) => void;
  onCancel?: () => void;
  /** Hide the trip summary when the host page already shows one. */
  showSummary?: boolean;
  /** Prefill from an existing booking (editing details before paying). */
  initial?: Booking | null;
}

const SURF_LEVELS: { value: BookingInput['surf_level']; label: string }[] = [
  { value: 'never', label: 'Never surfed' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const COUNTRIES = [
  'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'Chile', 'Colombia', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'India', 'Indonesia', 'Ireland',
  'Israel', 'Italy', 'Japan', 'Lithuania', 'Mexico', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Romania', 'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sweden',
  'Switzerland', 'Thailand', 'Turkey', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Vietnam', 'Other',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registration form shown between "Book Now" and the checkout. Saves the
 * details on the pending booking (POST /api/bookings) and moves straight on
 * to payment — it is not an application filter.
 */
export function BookingForm({ trip, onSaved, onCancel, showSummary = true, initial = null }: BookingFormProps) {
  const { user } = usePrivy();
  const call = useApi();
  const privyEmail = user?.email?.address ?? user?.google?.email ?? '';

  const [initialFirst, ...initialRest] = (initial?.full_name ?? '').split(' ');
  const [firstName, setFirstName] = useState(initialFirst ?? '');
  const [lastName, setLastName] = useState(initialRest.join(' '));
  const [email, setEmail] = useState(initial?.email ?? privyEmail);
  const [telegram, setTelegram] = useState(initial?.telegram ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [surfLevel, setSurfLevel] = useState<BookingInput['surf_level'] | ''>(initial?.surf_level ?? '');
  const [workingOn, setWorkingOn] = useState(initial?.working_on ?? '');
  const [dietary, setDietary] = useState(initial?.dietary ?? '');
  const [agreed, setAgreed] = useState(Boolean(initial?.agreed_terms_at));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const telegramHandle = telegram.trim().replace(/^@+/, '');
  const emailValid = EMAIL_RE.test(email.trim());

  const complete = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      emailValid &&
      telegramHandle.length > 0 &&
      country.length > 0 &&
      surfLevel !== '' &&
      workingOn.trim().length > 0 &&
      agreed,
    [firstName, lastName, emailValid, telegramHandle, country, surfLevel, workingOn, agreed],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const body: BookingInput = {
      trip_id: trip.id,
      seats: 1,
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim(),
      telegram: telegramHandle,
      country,
      surf_level: surfLevel as BookingInput['surf_level'],
      working_on: workingOn.trim(),
      dietary: dietary.trim(),
      agreed_terms: true,
    };
    try {
      const booking = await call<Booking>('/api/bookings', { method: 'POST', body });
      onSaved(booking);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.body && typeof err.body === 'object') {
        const fe = (err.body as { error?: { fieldErrors?: Record<string, string[]> } }).error?.fieldErrors ?? {};
        setFieldErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]])));
        setError('Please check the highlighted fields.');
      } else if (err instanceof ApiError && err.status === 409) {
        setError(err.message === 'Not enough seats' ? 'Sorry — this trip just sold out.' : 'You already have a booking for this trip. Check "My bookings".');
      } else {
        setError(err instanceof Error ? err.message : 'Could not save your details');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {/* summary */}
      {showSummary && (
      <div className="rounded-2xl bg-surface px-4 py-3 text-sm">
        <p className="font-semibold text-ink">{trip.title}</p>
        <span className="chip chip-lilac mt-1.5">{formatDateRange(trip.starts_on, trip.ends_on)}</span>
        <PriceTag trip={trip} size="sm" className="mt-2" />
      </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={fieldErrors.full_name}>
          <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
        </Field>
        <Field label="Last name">
          <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
        </Field>
      </div>

      <Field label="Email" error={fieldErrors.email ?? (email && !emailValid ? 'Enter a valid email' : undefined)}>
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </Field>

      <Field label="Telegram" helper="How we reach you before the trip" error={fieldErrors.telegram}>
        <div className="flex items-center rounded-xl border border-line bg-paper transition-colors focus-within:border-ink">
          <span className="label pl-3.5 text-mute">@</span>
          <input
            className="w-full rounded-xl bg-transparent px-2 py-2.5 text-sm outline-none"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value.replace(/^@+/, ''))}
            placeholder="yourhandle"
            autoComplete="off"
            required
          />
        </div>
      </Field>

      <Field label="Country" error={fieldErrors.country}>
        <select className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)} required>
          <option value="" disabled>
            Select…
          </option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Surf level" error={fieldErrors.surf_level}>
        <div className="flex flex-wrap gap-2">
          {SURF_LEVELS.map((lvl) => {
            const on = surfLevel === lvl.value;
            return (
              <label
                key={lvl.value}
                className={`label cursor-pointer rounded-full px-3.5 py-2 transition-colors ${
                  on ? 'bg-mustard text-ink' : 'border border-line bg-paper text-mute hover:border-ink hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="surf_level"
                  value={lvl.value}
                  checked={on}
                  onChange={() => setSurfLevel(lvl.value)}
                  className="sr-only"
                />
                {lvl.label}
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="What are you working on?" helper="One line" error={fieldErrors.working_on}>
        <textarea className={`${inputCls} resize-none`} rows={2} maxLength={280} value={workingOn} onChange={(e) => setWorkingOn(e.target.value)} required />
      </Field>

      <Field label="Dietary restrictions or allergies" helper="Optional">
        <input className={inputCls} value={dietary} onChange={(e) => setDietary(e.target.value)} />
      </Field>

      <label className="flex items-start gap-2 text-sm text-ink/80">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-coral" required />
        <span>
          I've read and agree to the{' '}
          <a href="/code-of-conduct" className="underline underline-offset-2" target="_blank" rel="noreferrer">
            Code of Conduct
          </a>{' '}
          and{' '}
          <a href="/terms" className="underline underline-offset-2" target="_blank" rel="noreferrer">
            Terms
          </a>
        </span>
      </label>
      {fieldErrors.agreed_terms && <p className="-mt-3 text-xs text-red-700">{fieldErrors.agreed_terms}</p>}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <button type="submit" disabled={!complete || submitting} className="btn-primary btn-lg w-full">
        {submitting ? 'Saving…' : initial ? 'Save and continue' : 'Continue to payment'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="btn-secondary w-full">
          Cancel
        </button>
      )}
    </form>
  );
}

const inputCls = 'field';

function Field({ label, helper, error, children }: { label: string; helper?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-700">{error}</span>
      ) : helper ? (
        <span className="mt-1.5 block text-xs text-mute">{helper}</span>
      ) : null}
    </label>
  );
}
