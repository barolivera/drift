import { Outlet, useLocation } from 'react-router-dom';
import { Nav } from './Nav';

/**
 * App chrome. The nav is a pill that sits inside the page gutter with a
 * little air above it. On the Home it floats over the hero photo (the hero
 * fills the viewport and reframes); elsewhere it's sticky on paper.
 */
export function Layout() {
  const { pathname } = useLocation();
  const fullBleed = pathname === '/' || /^\/trips\/[^/]+$/.test(pathname);
  const onPhoto = pathname === '/';
  return (
    <div className="relative flex min-h-full flex-col bg-paper">
      <header
        className={
          onPhoto
            ? 'nav-after-hero absolute inset-x-0 top-0 z-40 px-[calc(var(--gutter)+18px)] pt-[calc(var(--gutter)+18px)]'
            : 'sticky top-0 z-40 bg-paper/85 px-6 pb-2 pt-[18px] backdrop-blur md:px-10 xl:px-12'
        }
      >
        <Nav />
      </header>
      <main className={fullBleed ? 'flex-1' : 'w-full flex-1 px-6 py-10 md:px-10 xl:px-12'}>
        <Outlet />
      </main>
      <footer className="flex w-full flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between md:px-10 xl:px-12">
        <span className="label text-mute">Drift · surf residencies · Brazil 2027</span>
        <span className="label text-mute">payments settle on Base via P2P.me</span>
      </footer>
    </div>
  );
}
