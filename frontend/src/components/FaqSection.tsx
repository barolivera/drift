import { Faq } from '@/components/Faq';
import { ui } from '@/lib/ui';
import { Reveal } from '@/components/Reveal';

/** The FAQ band: full-width surface background, section title, stacked question cards. Shared by Home and Trip Detail. */
export function FaqSection() {
  return (
    // full-width surface band; the negative margins let it break out of a page rendered inside the content column
    <section id="faq" className={`scroll-mt-24 bg-surface py-24 mx-[calc(50%-50vw)]`}>
      <div className={ui.content}>
        <Reveal as="h2" className={ui.sectionTitle}>Common questions</Reveal>
        <Reveal delay={90}>
          <Faq className="mt-10" />
        </Reveal>
      </div>
    </section>
  );
}
