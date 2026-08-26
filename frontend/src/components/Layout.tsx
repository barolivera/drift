import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { AuthButton } from './AuthButton';

const nav = [
  { to: '/trips', label: 'Trips' },
  { to: '/#faq', label: 'FAQ' },
  { to: '/profile', label: 'My bookings' },
];

/**
 * App chrome. Nav follows the ElevenLabs pattern: paper background, logo
 * left, quiet links in the middle, two pills on the right (outline + solid
 * coral). No hard border — a 1px hairline at very low contrast.
 */
export function Layout() {
  const { pathname } = useLocation();
  const { authenticated } = usePrivy();
  const fullBleed = pathname === '/' || /^\/trips\/[^/]+$/.test(pathname);
  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-ink">
            drift<span className="text-coral">.</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink/80 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => `transition-colors hover:text-ink ${isActive && !n.to.includes('#') ? 'text-ink' : ''}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/trips" className={authenticated ? 'btn-primary btn-sm' : 'btn-secondary btn-sm hidden sm:inline-flex'}>
              Book a seat
            </Link>
            <AuthButton />
          </div>
        </div>
        <div className="h-px w-full bg-line/70" />
      </header>
      <main className={fullBleed ? 'flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8'}>
        <Outlet />
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="pixel text-mute">Drift · surf residencies · Brazil 2027</span>
        <span className="pixel text-mute">payments settle on Base via P2P.me</span>
      </footer>
    </div>
  );
}
