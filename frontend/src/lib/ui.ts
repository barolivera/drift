/**
 * Shared layout + type scale. Every page imports these instead of repeating
 * class strings, so Home, Trips, Trip Detail, Profile and Book share one
 * rhythm. Colour, radius and component utilities live in index.css.
 *
 *   hero     — wide, small viewport inset. Only the Home hero uses it.
 *   content  — the reading column: centred, max 1152px, generous side margin.
 *   section  — vertical rhythm between content sections.
 */
export const ui = {
  hero: 'w-full px-6 md:px-10 xl:px-12',
  content: 'mx-auto w-full max-w-6xl px-6 md:px-8',
  section: 'py-20 md:py-24',

  /** page / section titles — display face, 40–72px */
  h1: 'display text-[clamp(2.5rem,5.2vw,4.5rem)] text-ink',
  h2: 'display text-[clamp(2.5rem,5.2vw,4.5rem)] text-ink',
  /** Home section titles — display face, 32–48px, tight leading */
  sectionTitle: 'display text-[clamp(2rem,3.4vw,3rem)] leading-[1.15] text-ink',
  /** secondary titles — display face, 32–48px */
  title: 'display text-[clamp(2rem,3.6vw,3rem)] text-ink',
  /** card / item titles — text face */
  h3: 'text-xl font-semibold tracking-tight text-ink',
  eyebrow: 'label text-mute',
  lede: 'text-lede text-ink/80',
  body: 'text-base leading-relaxed text-ink/80',
  muted: 'text-base leading-relaxed text-mute',
} as const;
