import { FaqList } from "@/components/FaqList";
import { LABEL, PAGE } from "@/lib/layout";

export function BGFaq() {
  return (
    <section id="faq" className="border-b border-border py-16 md:py-24">
      <div className={PAGE}>
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className={LABEL}>FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The questions before the first deploy.</h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              If something is not shipped, it is not promised here. The CLI help is the source of truth.
            </p>
          </div>
          <FaqList />
        </div>
      </div>
    </section>
  );
}
