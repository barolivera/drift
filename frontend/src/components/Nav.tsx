import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { api, type Trip } from '@/lib/api';

/**
 * Pill nav (Trawelt shape): a forest capsule split into segments — wordmark,
 * links, and the controls. Coral appears exactly once: "Book a seat", which
 * is a dropdown straight into each edition's booking flow (Trips is for
 * browsing). Account collapses into an avatar dropdown.
 */
export function Nav() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [trips, setTrips] = useState<Trip[]>([]);
  useEffect(() => {
    api<Trip[]>('/api/trips').then(setTrips).catch(() => setTrips([]));
  }, []);

  const email = user?.email?.address ?? user?.google?.email ?? null;
  const label = email ?? (user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}` : 'Account');
  const initial = (email ?? 'D').slice(0, 1).toUpperCase();

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3.5 py-2 text-[16px] font-medium transition-colors hover:bg-ink/5 ${isActive ? 'text-ink' : 'text-ink/80'}`;
  // Trawelt geometry, measured on trawelt.com @1440: contiguous segments, 72px tall,
  // 15px radius each (the notches come from the corners meeting), #f4f3ef fill.
  const segment = 'flex h-[60px] items-center rounded-[15px] bg-surface text-ink md:h-[72px]';

  return (
    <div className="flex items-stretch">
      {/* segment 1 — wordmark */}
      <Link to="/" className={`${segment} px-5 font-display text-xl font-extrabold tracking-tight md:px-8`}>
        drift<span className="text-coral">.</span>
      </Link>

      {/* segment 2 — links, right-aligned like Trawelt (hidden on mobile) */}
      <nav className={`${segment} hidden flex-1 justify-end gap-1 px-4 md:flex`}>
        <NavLink to="/trips" className={link}>
          Trips
        </NavLink>
      </nav>

      {/* segment 3 — the actions */}
      <div className={`${segment} flex-1 justify-end gap-2 px-2.5 md:flex-none md:px-3`}>
        <Dropdown
          align="right"
          trigger={(open) => (
            <button className="btn-primary whitespace-nowrap px-4 py-2.5 md:px-5" aria-haspopup="menu" aria-expanded={open}>
              Book a seat <Chevron open={open} />
            </button>
          )}
        >
          <p className="label px-3 pb-1 pt-2 text-mute">Pick your edition</p>
          {trips.length === 0 && <p className="px-3 py-2 text-sm text-mute">Loading…</p>}
          {trips.map((t) => {
            const soldOut = t.seats_left <= 0;
            return (
              <MenuLink key={t.id} to={soldOut ? `/trips/${t.id}` : `/trips/${t.id}/book`}>
                <span className="whitespace-nowrap font-semibold">{t.title.split(' — ')[0]}</span>
                <span className={`label whitespace-nowrap ${soldOut ? 'text-mute' : 'text-forest'}`}>{soldOut ? 'Sold out' : `${t.seats_left} of ${t.capacity} seats`}</span>
              </MenuLink>
            );
          })}
        </Dropdown>

        {!ready && <span className="label px-3 text-mute">…</span>}
        {ready && !authenticated && (
          <button onClick={login} className="btn whitespace-nowrap border border-ink/25 px-4 py-2.5 text-ink hover:border-ink hover:bg-ink/5 md:px-5">
            Log in
          </button>
        )}
        {ready && authenticated && (
          <Dropdown
            align="right"
            trigger={(open) => (
              <button
                aria-label="Account"
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-sm font-bold text-paper transition hover:bg-forest/90"
              >
                {initial}
              </button>
            )}
          >
            <p className="truncate px-3 pb-1 pt-2 text-sm text-mute" title={label}>
              {label}
            </p>
            <div className="my-1 h-px bg-line" />
            <MenuLink to="/profile">My bookings</MenuLink>
            <div className="md:hidden">
              <MenuLink to="/trips">Trips</MenuLink>
            </div>
            <div className="my-1 h-px bg-line" />
            <button onClick={logout} className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-surface">
              Log out
            </button>
          </Dropdown>
        )}
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-6 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface">
      {children}
    </Link>
  );
}

/** Minimal dropdown: click to toggle, closes on outside click, Escape and route change. */
function Dropdown({ trigger, children, align = 'left' }: { trigger: (open: boolean) => ReactNode; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname, hash } = useLocation();

  useEffect(() => setOpen(false), [pathname, hash]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div
          role="menu"
          className={`fixed inset-x-6 top-[calc(18px+60px+0.5rem)] z-50 rounded-[20px] bg-paper p-2 text-ink shadow-pop md:absolute md:inset-x-auto md:top-[calc(100%+0.5rem)] md:min-w-[280px] ${
            align === 'right' ? 'md:right-0' : 'md:left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
