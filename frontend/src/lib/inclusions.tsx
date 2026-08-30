import type { SVGProps } from 'react';
import { BlocksMark, BoardMark, BowlMark, HouseMark, LaptopMark, PalmMark, RoadMark, SunMark, WaveMark, YogaMark } from '@/components/Marks';

export type Mark = (p: SVGProps<SVGSVGElement> & { title?: string }) => JSX.Element;

export interface Inclusion {
  label: string;
  detail: string;
  Icon: Mark;
  /** Exported artwork for the Home list (public/images/marks); the line icon is the fallback. */
  art?: { src: string; w: number; h: number };
}

const art = (name: string, w = 56, h = 56) => ({ src: `/images/marks/inc-${name}.svg`, w, h });

/** What every edition includes — the six that matter, shown on the Home. No hours, no order. */
export const HOME_INCLUSIONS: Inclusion[] = [
  { label: 'Surf', detail: 'Coached sessions split by level, boards and wetsuits included.', Icon: WaveMark, art: art('surf') },
  { label: 'Deep work', detail: 'Three protected hours a day. No meetings, no calls in shared space.', Icon: LaptopMark, art: art('deepwork') },
  { label: 'Yoga', detail: 'Morning yoga and mobility, every day.', Icon: YogaMark, art: art('yoga', 49.83, 19.29) },
  { label: 'Meals', detail: 'Breakfast every day and dinner at one long table, everyone.', Icon: BowlMark, art: art('meals') },
  { label: 'The house', detail: 'Just a few minutes from the sand, room of your choice.', Icon: HouseMark, art: art('house') },
  { label: 'And more', detail: 'Airport transfers, a demo night, an off-grid day, workshops and a hack day.', Icon: PalmMark, art: art('more') },
];

/* Keyword → label + icon, used to render a trip's `included` strings from the DB. */
const RULES: { re: RegExp; label: string; Icon: Mark }[] = [
  // most specific first — "work room" and "demo night" must not fall into "The house"
  { re: /work room|fibre|monitor|deep work/i, label: 'Deep work', Icon: LaptopMark },
  { re: /programme|workshop|demo|hack day/i, label: 'Demo night', Icon: BlocksMark },
  { re: /breakfast|dinner|meal|long table/i, label: 'Meals', Icon: BowlMark },
  { re: /board|wetsuit/i, label: 'Boards', Icon: BoardMark },
  { re: /coached|surf/i, label: 'Surf', Icon: WaveMark },
  { re: /yoga|mobility/i, label: 'Yoga', Icon: YogaMark },
  { re: /transfer|airport/i, label: 'Transfers', Icon: RoadMark },
  { re: /off-grid|boat|waterfall|trail/i, label: 'Off-grid day', Icon: SunMark },
  { re: /night|room|house/i, label: 'The house', Icon: HouseMark },
];

/** Artwork for the list variant, by label (falls back to the line icon). */
const ART_BY_LABEL: Record<string, Inclusion['art']> = {
  Surf: art('surf'),
  Boards: art('surf'),
  'Deep work': art('deepwork'),
  Yoga: art('yoga', 49.83, 19.29),
  Meals: art('meals'),
  'The house': art('house'),
  'Demo night': art('more'),
  Transfers: art('more'),
  'Off-grid day': art('more'),
};

export function inclusionsFrom(included: string[]): Inclusion[] {
  return included.map((detail) => {
    const rule = RULES.find((r) => r.re.test(detail));
    const label = rule?.label ?? 'Included';
    return { label, detail, Icon: rule?.Icon ?? SunMark, art: ART_BY_LABEL[label] };
  });
}
