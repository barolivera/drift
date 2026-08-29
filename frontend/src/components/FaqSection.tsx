import { Faq } from '@/components/Faq';
import { ui } from '@/lib/ui';

/** The FAQ band: a rounded surface panel inside the content column, centred label, stacked question cards. Shared by Home and Trip Detail. */
export function FaqSection() {
  return (
    <section id="faq" className={`${ui.content} scroll-mt-24 ${ui.section}`}>
      <div className="rounded-[28px] bg-surface px-4 py-12 sm:px-8 md:px-12 md:py-16">
        <p className="label text-center text-sm text-mute">Common questions</p>
        <Faq className="mt-10" />
      </div>
    </section>
  );
}
