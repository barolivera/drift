import type { SVGProps } from 'react';
import { BlocksMark, BoardMark, BowlMark, HouseMark, LaptopMark, RoadMark, SunMark, WaveMark, YogaMark } from '@/components/Marks';

export type Mark = (p: SVGProps<SVGSVGElement> & { title?: string }) => JSX.Element;

export interface Inclusion {
  label: string;
  detail: string;
  Icon: Mark;
}

/** What every edition includes — shown on the Home. No hours, no order. */
export const HOME_INCLUSIONS: Inclusion[] = [
  { label: 'Surf', detail: 'Coached sessions split by level, video review twice a week.', Icon: WaveMark },
  { label: 'Deep work', detail: 'Three protected hours a day. No meetings, no calls in shared space.', Icon: LaptopMark },
  { label: 'Yoga', detail: 'Morning yoga and mobility. Your shoulders will need it by day four.', Icon: YogaMark },
  { label: 'Meals', detail: 'Breakfast every day and dinner at one long table, everyone.', Icon: BowlMark },
  { label: 'The house', detail: 'Fourteen nights a few minutes from the sand, room of your choice.', Icon: HouseMark },
  { label: 'Boards', detail: 'Boards and wetsuits for the whole stay. Bring nothing but yourself.', Icon: BoardMark },
  { label: 'Demo night', detail: 'Workshops, a hack day, and a demo night on the last Thursday.', Icon: BlocksMark },
  { label: 'Off-grid day', detail: 'One day with no plan: a boat, a waterfall or a coastal trail.', Icon: SunMark },
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

export function inclusionsFrom(included: string[]): Inclusion[] {
  return included.map((detail) => {
    const rule = RULES.find((r) => r.re.test(detail));
    return { label: rule?.label ?? 'Included', detail, Icon: rule?.Icon ?? SunMark };
  });
}
