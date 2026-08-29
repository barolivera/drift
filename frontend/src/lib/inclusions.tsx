import type { SVGProps } from 'react';
import { BlocksMark, BoardMark, BowlMark, HouseMark, LaptopMark, PalmMark, RoadMark, SunMark, WaveMark, YogaMark } from '@/components/Marks';

export type Mark = (p: SVGProps<SVGSVGElement> & { title?: string }) => JSX.Element;

export interface Inclusion {
  label: string;
  detail: string;
  Icon: Mark;
}

/** What every edition includes — the six that matter, shown on the Home. No hours, no order. */
export const HOME_INCLUSIONS: Inclusion[] = [
  { label: 'Surf', detail: 'Coached sessions split by level, boards and wetsuits included.', Icon: WaveMark },
  { label: 'Deep work', detail: 'Three protected hours a day. No meetings, no calls in shared space.', Icon: LaptopMark },
  { label: 'Yoga', detail: 'Morning yoga and mobility, every day.', Icon: YogaMark },
  { label: 'Meals', detail: 'Breakfast every day and dinner at one long table, everyone.', Icon: BowlMark },
  { label: 'The house', detail: 'Fourteen nights a few minutes from the sand, room of your choice.', Icon: HouseMark },
  { label: 'And more', detail: 'Airport transfers, a demo night, an off-grid day, workshops and a hack day.', Icon: PalmMark },
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
