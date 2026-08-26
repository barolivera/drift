const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
}

export async function api<T>(path: string, { body, token, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error?.toString?.() ?? res.statusText, res.status, data);
  return data as T;
}

// ---------- types mirroring backend ----------
export type SurfLevel = 'beginner' | 'intermediate' | 'advanced' | 'all';

export interface Spot {
  id: string;
  slug: string;
  name: string;
  state: string;
  city: string;
  cover_url: string | null;
}

export interface ScheduleItem {
  time: string;
  title: string;
  detail: string;
  /** true on the deep-work block — the product's differentiator */
  highlight?: boolean;
}

export interface Trip {
  id: string;
  slug: string | null;
  title: string;
  /** e.g. "Itamambuca, Ubatuba, Brazil" */
  location: string | null;
  description: string | null;
  description_long: string | null;
  starts_on: string;
  ends_on: string;
  /** total seats (spots_total) */
  capacity: number;
  seats_taken: number;
  seats_left: number;
  price_usdc: string;
  /** regular price once the founding seats are gone; null = no founding offer */
  price_full_usdc: string | null;
  founding_seats: number | null;
  includes: string[];
  included: string[];
  not_included: string[];
  who_its_for: string | null;
  daily_schedule: ScheduleItem[];
  level: SurfLevel;
  spot: Spot;
  host: { id: string; display_name: string | null; avatar_url: string | null };
}

/** "900.00" → "from 900 USDC" */
export function formatPrice(price: string | number): string {
  return `from ${formatUsdc(price)} USDC`;
}

/** "1200.00" → "1,200" */
export function formatUsdc(price: string | number): string {
  return Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Founding-cohort offer is live when a full price exists and is higher than the current one. */
export function hasFoundingPrice(t: Pick<Trip, 'price_usdc' | 'price_full_usdc' | 'founding_seats'>): boolean {
  return t.price_full_usdc != null && Number(t.price_full_usdc) > Number(t.price_usdc);
}

/** 2027-01-16 → 2027-01-30 → "16 – 30 Jan 2027" / "24 Apr – 8 May 2027" */
export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  const day = (d: Date) => d.getUTCDate();
  const mon = (d: Date) => d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = e.getUTCFullYear();
  if (s.getUTCMonth() === e.getUTCMonth()) return `${day(s)} – ${day(e)} ${mon(e)} ${year}`;
  return `${day(s)} ${mon(s)} – ${day(e)} ${mon(e)} ${year}`;
}

/** Nights between two YYYY-MM-DD dates. */
export function nights(start: string, end: string): number {
  return Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86_400_000);
}

export type BookingSurfLevel = 'never' | 'beginner' | 'intermediate' | 'advanced';

/** Body of POST /api/bookings — the registration form. */
export interface BookingInput {
  trip_id: string;
  seats?: number;
  full_name: string;
  email: string;
  telegram: string; // without '@'
  country: string;
  surf_level: BookingSurfLevel;
  working_on: string;
  dietary?: string;
  agreed_terms: true;
}

export interface Booking {
  id: string;
  trip_id: string;
  seats: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  full_name?: string | null;
  email?: string | null;
  telegram?: string | null;
  country?: string | null;
  surf_level?: BookingSurfLevel | null;
  working_on?: string | null;
  dietary?: string | null;
  agreed_terms_at?: string | null;
  title: string;
  starts_on: string;
  ends_on: string;
  price_usdc: string;
  price_full_usdc?: string | null;
  founding_seats?: number | null;
  spot: { name: string; city: string; state: string };
}

export interface PaymentStatus {
  payment_id: string;
  order_id: string;
  status: 'pending' | 'processing' | 'settled' | 'failed' | 'refunded';
  amount_usdc: string;
  tx_hash: string | null;
  updated_at: string;
  booking_id: string;
  booking_status: Booking['status'];
}

export interface Me {
  id: string;
  privy_did: string;
  email: string | null;
  wallet_address: string | null;
  display_name: string | null;
  is_host: boolean;
}
