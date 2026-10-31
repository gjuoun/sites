import { BGCopyButton } from "@sites/bigface/components/bg/copy-button";
const SAMPLE = [
  "// one grid, two families",
  'import { render, surface } from "pocketjs";',
  "",
  "export function counter() {",
  "  const label = () => `点了 ${count.value} 次`;   // 中英混排，字距稳定",
  '  return button("加一", { onPress: () => count.value++ });',
  "}",
].join("\n");

export function BGSpecimenLong() {
  return (
    <section id="text" className="scroll-mt-24 py-10">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] transition-[opacity,translate] duration-700 [.js_&]:translate-y-4 [.js_&]:opacity-0 [.js_&.in]:translate-y-0 [.js_&.in]:opacity-100" data-reveal>
        <div className="mb-[1.6rem] max-w-[62ch]">
          <p className="my-[1em] max-w-[68ch] inline-flex items-center gap-2 font-mono text-[0.72rem] tracking-[0.16em] text-foreground/75 uppercase before:size-[6px] before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] before:content-['']">
            05 — Running text
          </p>
          <h2 className="mt-2 mb-[0.7rem] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-balance">Prose next to code</h2>
          <p className="my-[1em] max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-foreground/75">
            The same hanzi serve both families. Body copy goes to Qu Black Sans; anything the reader has to compare
            character by character stays in Qu Black Mono.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2" data-two-column>
          <div className="rounded-[18px] border border-border bg-card/70 p-[clamp(1.1rem,2.5vw,1.7rem)]" data-specimen>
            <p className="max-w-[68ch] m-0 text-[1.02rem] leading-[1.78]">
              编译产物不是「打包好的 CSS + compiled JS + 一个 HTML」，而是一个{" "}
              <code className="font-mono border border-border bg-[color-mix(in_srgb,var(--border)_8%,transparent)] px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-yellow">app.js</code> 加一个二进制的{" "}
              <code className="font-mono border border-border bg-[color-mix(in_srgb,var(--border)_8%,transparent)] px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-yellow">app.pak</code>。TSX 走 MicroTS 编到 JS，交给 QuickJS
              执行；Tailwind 的类名在构建期换成二进制样式表，运行时只查表。
            </p>
            <p className="max-w-[68ch] mt-4 mb-0 text-[1.02rem] leading-[1.78]">
              Typesetting note: Chinese line height should not copy Latin's 1.5 — 1.78 reads better, and identifiers such as{" "}
              <code className="font-mono border border-border bg-[color-mix(in_srgb,var(--border)_8%,transparent)] px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-yellow">className</code> or <code className="font-mono border border-border bg-[color-mix(in_srgb,var(--border)_8%,transparent)] px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-yellow">web-compat</code> must stay in the
              mono family, or <code className="font-mono border border-border bg-[color-mix(in_srgb,var(--border)_8%,transparent)] px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-yellow">i</code> and <code className="font-mono border border-border bg-[color-mix(in_srgb,var(--border)_8%,transparent)] px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-yellow">l</code> collapse into each
              other.
            </p>
          </div>

          <div className="overflow-hidden rounded-[18px] border border-border bg-card/85">
            <div className="flex items-center justify-between gap-4 px-3 pt-2 pb-2 font-mono text-[0.7rem]">
              <span className="text-muted-foreground">counter.tsx</span>
              <BGCopyButton value={SAMPLE} />
            </div>
            <pre className="m-0 overflow-x-auto rounded-[10px] border border-border bg-[color-mix(in_srgb,var(--card)_72%,transparent)] p-3 font-mono text-[0.82rem] leading-[1.7] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5]">
              <code>{SAMPLE}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
