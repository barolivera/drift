/**
 * Placeholder photography for the landing page.
 *
 * All images are from Unsplash (free licence, attribution appreciated) and
 * are meant to be REPLACED with Drift's own photos once the first edition
 * has run. Each entry keeps the Unsplash page + author so the swap is easy
 * and so we can credit correctly meanwhile.
 *
 * The `src` builder requests a width-capped, auto-format crop from the
 * Unsplash CDN; pass the rendered width to avoid shipping 3000px files.
 */

export interface Photo {
  /** images.unsplash.com photo id */
  id: string;
  author: string;
  /** Unsplash photo page — for credit / replacement */
  page: string;
  alt: string;
  location?: string;
}

export const photos = {
  /** HERO — full-bleed coastline. */
  hero: {
    // https://unsplash.com/photos/LTzNCDXgfRI — Agnaldo Andrella — Ubatuba, SP, Brasil
    id: 'photo-1591018600989-1ec40cdd3322',
    author: 'Agnaldo Andrella',
    page: 'https://unsplash.com/photos/LTzNCDXgfRI',
    alt: 'Sand and sea at Ubatuba, São Paulo',
    location: 'Ubatuba, SP',
  },
  /** EDITIONS — Itamambuca (rendered small, black & white). */
  itamambuca: {
    // https://unsplash.com/photos/O8O9L0cqCoI — Agnaldo Andrella — Ubatuba, SP, Brasil
    id: 'photo-1591018607803-0b6f5aeb3b6f',
    author: 'Agnaldo Andrella',
    page: 'https://unsplash.com/photos/O8O9L0cqCoI',
    alt: 'Tree on a white-sand beach in Ubatuba',
    location: 'Ubatuba, SP',
  },
  /** EDITIONS — Praia do Rosa (rendered small, black & white). */
  praiaDoRosa: {
    // https://unsplash.com/photos/dzJxwoJZR7A — Andre Blanco — Santa Catarina, Brazil
    id: 'photo-1725378531698-fbc644a0f0f8',
    author: 'Andre Blanco',
    page: 'https://unsplash.com/photos/dzJxwoJZR7A',
    alt: 'Path down to a beach in Santa Catarina',
    location: 'Santa Catarina',
  },
  /** WHO IT'S FOR — remote workers. */
  remoteWorkers: {
    // https://unsplash.com/photos/Pd8tLVGx2O4 — Helena Lopes — Belo Horizonte, Brazil
    id: 'photo-1519155031214-e8d583928bf2',
    author: 'Helena Lopes',
    page: 'https://unsplash.com/photos/Pd8tLVGx2O4',
    alt: 'A group working on laptops around a table',
    location: 'Belo Horizonte',
  },
  /** WHO IT'S FOR — founders and builders. */
  builders: {
    // https://unsplash.com/photos/dWYU3i-mqEo — Annie Spratt
    id: 'photo-1522071901873-411886a10004',
    author: 'Annie Spratt',
    page: 'https://unsplash.com/photos/dWYU3i-mqEo',
    alt: 'Two people working together on a laptop',
  },
  /** FOOTER CTA — surfer walking to the water. */
  footer: {
    // https://unsplash.com/photos/8wfuOp5Po9c — Gabriel Bezerra — Praia do Paiva, PE, Brasil
    id: 'photo-1609365635346-524d0024684f',
    author: 'Gabriel Bezerra',
    page: 'https://unsplash.com/photos/8wfuOp5Po9c',
    alt: 'Surfer carrying a board along a Brazilian beach',
    location: 'Praia do Paiva, PE',
  },
} satisfies Record<string, Photo>;

/** Spare, already verified: https://unsplash.com/photos/aGMIRH_B4K0 — Marcos Paulo Prado — surfer, Rio
 *  (photo-1594749794764-717b02dbb530) and https://unsplash.com/photos/7bIwLoJosJ0 — Agnaldo Andrella —
 *  rocks at Ubatuba (photo-1588955865271-027087da0548). */

export function src(photo: Photo, width: number, extra = ''): string {
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${width}&q=75${extra}`;
}

/** srcset for responsive full-bleed images. */
export function srcSet(photo: Photo, widths: number[] = [640, 1024, 1600, 2200]): string {
  return widths.map((w) => `${src(photo, w)} ${w}w`).join(', ');
}
