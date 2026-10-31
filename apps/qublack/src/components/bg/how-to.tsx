import { HOW_TO_TABS } from "../../data/how-to.ts";
import { BGEyebrow } from "@sites/bigface/components/bg/eyebrow";
import { BGHowToTabs } from "./how-to-tabs.tsx";

// One tab per place the family has to work: the desktop, the browser, the terminal, the build.
// Snippets come from data/how-to.ts so the release URL and the family names live in one place.
export function BGHowTo() {
  return (
    <section id="howto" className="scroll-mt-24 py-10">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] transition-[opacity,translate] duration-700 [.js_&]:translate-y-4 [.js_&]:opacity-0 [.js_&.in]:translate-y-0 [.js_&.in]:opacity-100" data-reveal>
        <div className="mb-[1.6rem] max-w-[62ch]">
          <BGEyebrow>07 — How to use</BGEyebrow>
          <h2 className="mt-2 mb-[0.7rem] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-balance">Eight faces, four routes in</h2>
          <p className="my-[1em] max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-foreground/75">
            Install the family on your machine, self-host the TTFs on a page, point a terminal at Qu Black Mono, or wire it
            into a framework. Every snippet below is copy-ready.
          </p>
        </div>

        <BGHowToTabs tabs={HOW_TO_TABS} />
      </div>
    </section>
  );
}
