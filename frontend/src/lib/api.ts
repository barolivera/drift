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
  includes: string[];
  included: string[];
  not_included: string[];
  who_its_for: string | null;
  daily_schedule: ScheduleItem[];
  level: SurfLevel;
  spot: Spot;
  host: { id: string; display_name: string | null; avatar_url: string | null };
}

export interface Booking {
  id: string;
  trip_id: string;
  seats: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  title: string;
  starts_on: string;
  ends_on: string;
  price_usdc: string;
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
