import { Outlet, useLocation } from 'react-router-dom';
import { Nav } from './Nav';
import { ui } from '@/lib/ui';

/**
 * App chrome. The nav is a pill that sits inside the page gutter with a
 * little air above it. On the Home it floats over the hero photo (the hero
 * fills the viewport and reframes); elsewhere it's sticky on paper and the
 * page renders inside the shared content column (`ui.content`).
 */
export function Layout() {
  const { pathname } = useLocation();
  const home = pathname === '/';
  return (
    <div className="relative flex min-h-full flex-col bg-paper">
      <header
        className={
          home
            ? 'nav-after-hero absolute inset-x-0 top-0 z-40 px-[calc(var(--gutter)+18px)] pt-[calc(var(--gutter)+18px)]'
            : 'sticky top-0 z-40 bg-paper/85 px-6 pb-2 pt-[18px] backdrop-blur md:px-10 xl:px-12'
        }
      >
        <Nav />
      </header>
      <main className={home ? 'flex-1' : `${ui.content} flex-1 py-12 md:py-16`}>
        <Outlet />
      </main>
      <footer className={`${ui.content} flex flex-col gap-2 py-8 sm:flex-row sm:items-center sm:justify-between`}>
        <img src="/images/marks/wordmark.svg" alt="Drift" width={58} height={10} className="h-[10px] w-[58px]" />
        <span className="label text-mute">payments settle on Base via P2P.me</span>
      </footer>
    </div>
  );
}
