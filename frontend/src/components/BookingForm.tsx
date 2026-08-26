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
export function BookingForm({ trip, onSaved, onCancel }: BookingFormProps) {
  const { user } = usePrivy();
  const call = useApi();
  const privyEmail = user?.email?.address ?? user?.google?.email ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(privyEmail);
  const [telegram, setTelegram] = useState('');
  const [country, setCountry] = useState('');
  const [surfLevel, setSurfLevel] = useState<BookingInput['surf_level'] | ''>('');
  const [workingOn, setWorkingOn] = useState('');
  const [dietary, setDietary] = useState('');
  const [agreed, setAgreed] = useState(false);

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
      <div className="rounded-xl bg-sand-100 px-4 py-3 text-sm">
        <p className="font-semibold text-ocean-900">{trip.title}</p>
        <p className="text-ocean-700">{formatDateRange(trip.starts_on, trip.ends_on)}</p>
        <PriceTag trip={trip} size="sm" className="mt-1" />
      </div>

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

      <Field label="Telegram" helper="Trip comms happen on Telegram — this is how we reach you" error={fieldErrors.telegram}>
        <div className="flex items-center rounded-lg border border-sand-300 bg-white focus-within:border-ocean-500">
          <span className="pl-3 text-ocean-500">@</span>
          <input
            className="w-full rounded-lg bg-transparent px-2 py-2 text-sm outline-none"
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

      <Field label="Surf level" helper="All levels welcome — this is just so we can split the sessions" error={fieldErrors.surf_level}>
        <div className="grid grid-cols-2 gap-2">
          {SURF_LEVELS.map((lvl) => (
            <label
              key={lvl.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                surfLevel === lvl.value ? 'border-ocean-500 bg-ocean-50 text-ocean-900' : 'border-sand-300 bg-white text-ocean-700'
              }`}
            >
              <input
                type="radio"
                name="surf_level"
                value={lvl.value}
                checked={surfLevel === lvl.value}
                onChange={() => setSurfLevel(lvl.value)}
                className="accent-ocean-500"
              />
              {lvl.label}
            </label>
          ))}
        </div>
      </Field>

      <Field label="What are you working on?" helper="One line. We introduce residents to each other before you land" error={fieldErrors.working_on}>
        <textarea className={`${inputCls} resize-none`} rows={2} maxLength={280} value={workingOn} onChange={(e) => setWorkingOn(e.target.value)} required />
      </Field>

      <Field label="Dietary restrictions or allergies" helper="Optional">
        <input className={inputCls} value={dietary} onChange={(e) => setDietary(e.target.value)} />
      </Field>

      <label className="flex items-start gap-2 text-sm text-ocean-800">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-ocean-500" required />
        <span>
          I've read and agree to the{' '}
          <a href="/code-of-conduct" className="text-ocean-500 underline" target="_blank" rel="noreferrer">
            Code of Conduct
          </a>{' '}
          and{' '}
          <a href="/terms" className="text-ocean-500 underline" target="_blank" rel="noreferrer">
            Terms
          </a>
        </span>
      </label>
      {fieldErrors.agreed_terms && <p className="-mt-3 text-xs text-red-700">{fieldErrors.agreed_terms}</p>}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <button
        type="submit"
        disabled={!complete || submitting}
        className="w-full rounded-full bg-ocean-500 py-2.5 font-medium text-white hover:bg-ocean-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ocean-500"
      >
        {submitting ? 'Saving…' : 'Continue to payment'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="w-full text-sm text-ocean-500 hover:underline">
          Cancel
        </button>
      )}
    </form>
  );
}

const inputCls =
  'w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-ocean-900 outline-none focus:border-ocean-500';

function Field({ label, helper, error, children }: { label: string; helper?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ocean-900">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-700">{error}</span>
      ) : helper ? (
        <span className="mt-1 block text-xs text-ocean-700">{helper}</span>
      ) : null}
    </label>
  );
}
