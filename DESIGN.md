# Drift — Design System

## Philosophy
Floating cards on a single paper background. One disciplined accent color
(coral) for every action; secondary colors (forest, lilac, mustard) exist
only as identifiers, never as CTA fills. Real photography over illustration
— the surf/nature identity comes from the photos and the accent palette,
not from decoration.

## Color

| Token   | Hex       | Role                                             |
|---------|-----------|--------------------------------------------------|
| paper   | #FBFCFD   | base background, card surfaces                   |
| forest  | #224E35   | Itamambuca identifier, badge fills, icon strokes |
| lilac   | #B3ABEB   | secondary badge/tag identifier                   |
| mustard | #F1DB82   | secondary badge/tag identifier                   |
| coral   | #EC622A   | the only CTA fill — buttons, active states       |

Rule: if it's a button someone clicks to take an action, it's coral or
outline-on-coral. Everything else (forest/lilac/mustard) tags or identifies,
never instructs.

Neutrals that exist in code alongside the five above: `surface` #F4F3EF
(card fill), `surface-2` #EBEAE4 (hover/ghost chip), `ink` #16181C (text),
`mute` #6F727A (secondary text), `line` #E4E2DC (hairlines), plus `-soft`
tints of forest/lilac/mustard/coral and `coral-600` #D2521F for hover.

## Typography

- **Geist Pixel** (Square variant, `.display` utility) — display only: hero
  headline, edition names, short section titles. 2–5 words, one short
  line/sentence max — this is where a bitmap grid font earns its keep, as a
  bold graphic statement at large size (~32–90px). Breaks down at paragraph
  length or small sizes.
- **Manrope** — everything else: body copy (400/500, 14–18px), nav,
  buttons, AND labels — eyebrows, date/seat chips, wayfinding tags,
  booking ids (`.label` utility: 700, uppercase, tracked 0.08em, 11px).
  Labels moved here from Geist Pixel because small dense text (dates, ids)
  turns to noise in a bitmap font.

## Spacing & radius

- Two horizontal frames (`frontend/src/lib/ui.ts`): `ui.hero` — wide, small
  viewport inset (24/40/48px), Home hero only; `ui.content` — the reading
  column, centred, max 1152px, used by every other section and page.
- Vertical rhythm `ui.section`: 80px mobile / 96px desktop between sections.
- Base unit: 4px. Card padding: 40px.
- Radius: nav/inputs 10px · cards 20px · buttons 35px (full pill) ·
  boarding-pass stub segments 15px.

## Components

- **Nav**: paper background, logo left, pill buttons right (outline +
  coral solid).
- **Hero**: full-bleed photo (black & white), dark scrim left-to-right,
  Geist Pixel headline in white ("Pause the routine. Build together."),
  Manrope subtext, photo credit small in a corner.
- **Floating cards**: paper/light-gray surface, no border, soft shadow,
  20px radius — the base unit for every section below the hero.
- **Badge/patch marks**: shield-shaped frame around the line-art icons
  (`Patch` in Marks.tsx) — a "program patch," not freestanding icons.
- **Boarding pass edition card** (`EditionCard.tsx`) — a ticket shape:
  - Segment 1 — photo, full width, clean, no overlay tags.
  - Perforation divider between segments (torn-ticket line).
  - Segment 2 — stub, solid color per edition (forest/coral):
    - Metadata row: icon + date range, icon + seats — Manrope label
      style, paper-on-color.
    - Edition name — Geist Pixel, large, paper.
    - Bottom-right: "SEE THE EDITION" (underlined, Manrope label style)
      + arrow icon. Links to that edition's page. No price shown.
- **Inclusions grid** (`Inclusions.tsx`): patch icon + uppercase label +
  one-line description, 2 columns, no schedule/hours.
- **FAQ accordion** (`Faq.tsx`, items in `lib/faq.tsx`): houses the payment
  mechanics explanation (moved out of its own Home section).
- **"Pick your water" section**: title only, no eyebrow/date, no
  subtitle paragraph — the boarding pass cards carry all the info.

- **Checkout** (`pages/Book.tsx`): one stepper, four steps — Details ›
  Matching › Pay › Done — and a different screen per step. Details is two
  columns (form or saved details + "how you pay" left, order summary right).
  Matching and Verifying are one centred column with a coral spinner and one
  line of copy. Pay is one centred column: a one-line trip strip, then the
  local-currency amount, the QR and "I've sent" — nothing else. Done is the
  forest check disc, "Seat confirmed" and the next step (Telegram / My
  bookings). The payment widget keeps only what we cannot rebuild; its own
  title bar and stepper are hidden (`.p2p-host` in index.css).

## Imagery

- Hero photo: black & white / desaturated (`grayscale` on the `<img>`).
- Edition photos stay in color (the B&W treatment is a hero-only device).
- Photo credits: small, corner of the image, on the scrim or card.

## Source of truth

This file documents the tokens. The values themselves are defined once in
code — `frontend/src/index.css`, Tailwind v4 `@theme` block (colors, fonts,
type scale, `--spacing-section`, `--radius-*`, shadows) plus the `@utility`
rules right below it (`label`, `display`, `btn-*`, `chip-*`, `card`,
`field`). Any token change lands there first; this doc gets updated to
match, never the other way around.
