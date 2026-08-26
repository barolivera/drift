import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AuthButton } from './AuthButton';

const nav = [
  { to: '/trips', label: 'Trips' },
  { to: '/profile', label: 'My bookings' },
];

export function Layout() {
  const { pathname } = useLocation();
  const fullBleed = pathname === '/';
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-sand-300/60 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-xl font-semibold tracking-tight text-ocean-900">
            drift<span className="text-ocean-500">.</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `hover:text-ocean-500 ${isActive ? 'text-ocean-500 font-medium' : 'text-ocean-700'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <AuthButton />
          </nav>
        </div>
      </header>
      <main className={fullBleed ? 'flex-1' : 'mx-auto w-full max-w-5xl flex-1 px-4 py-8'}>
        <Outlet />
      </main>
      <footer className="border-t border-sand-300/60 py-6 text-center text-xs text-ocean-700">
        Drift — surf residencies in Brazil for people who build
      </footer>
    </div>
  );
}
