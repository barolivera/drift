import { Faq } from '@/components/Faq';
import { ui } from '@/lib/ui';

/** The FAQ band: full-width surface background, centred label, stacked question cards. Shared by Home and Trip Detail. */
export function FaqSection() {
  return (
    // full-width surface band; the negative margins let it break out of a page rendered inside the content column
    <section id="faq" className={`scroll-mt-24 bg-surface ${ui.section} mx-[calc(50%-50vw)]`}>
      <div className={ui.content}>
        <p className="label text-center text-sm text-mute">Common questions</p>
        <Faq className="mt-10" />
      </div>
    </section>
  );
}
