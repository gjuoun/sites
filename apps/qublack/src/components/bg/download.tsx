import { RELEASE_URL, VERSION, ZIP_NAME } from "../../data/site.ts";
import { BGButton } from "@sites/bigface/components/bg/button";
import { BGCopyButton } from "@sites/bigface/components/bg/copy-button";
import { BGDownloadCard } from "@sites/bigface/components/bg/download-card";

export interface BGDownloadProps {
  sha256: string;
}

export function BGDownload({ sha256 }: BGDownloadProps) {
  const installMac = "unzip -o " + ZIP_NAME + " -d ~/Library/Fonts/";
  const installLinux =
    "mkdir -p ~/.local/share/fonts && unzip -o " + ZIP_NAME + " -d ~/.local/share/fonts/ && fc-cache -f";
  return (
    <section id="download" className="scroll-mt-24 py-10 pb-16">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] transition-[opacity,translate] duration-700 [.js_&]:translate-y-4 [.js_&]:opacity-0 [.js_&.in]:translate-y-0 [.js_&.in]:opacity-100" data-reveal>
        <div className="mb-[1.6rem] max-w-[62ch]">
          <p className="my-[1em] max-w-[68ch] inline-flex items-center gap-2 font-mono text-[0.72rem] tracking-[0.16em] text-foreground/75 uppercase before:size-[6px] before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] before:content-['']">
            08 — Download
          </p>
          <h2 className="mt-2 mb-[0.7rem] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-balance">Eight faces, one zip</h2>
          <p className="my-[1em] max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-foreground/75">
            Qu Black Mono and Qu Black Sans, four styles each, plus <code className="font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground">OFL.txt</code>,{" "}
            <code className="font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground">NOTICE.md</code> and a README. Free for commercial use; redistribution keeps the
            licence.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2" data-two-column>
          <div className="grid gap-3">
            <BGDownloadCard href={RELEASE_URL} label={ZIP_NAME} detail={"release " + VERSION + " · TTF + TTC + WOFF2 + OFL + README"} />
            <BGDownloadCard href="https://github.com/gjuoun/qublack/releases" label="All releases" detail="tag history, checksums, notes" />
            <BGDownloadCard href="https://github.com/gjuoun/qublack/blob/main/OFL.txt" label="OFL.txt" detail="SIL Open Font License 1.1" />
            <BGDownloadCard href="https://github.com/gjuoun/qublack/blob/main/NOTICE.md" label="NOTICE.md" detail="provenance: Sarasa Gothic + Recursive" />
            <div className="rounded-[14px] border border-border bg-card/70 px-4 py-[0.8rem]" data-download-formats>
              <p className="max-w-[68ch] mb-2 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">formats</p>
              <ul className="m-0 grid list-none gap-[0.35rem] p-0 text-[0.8rem] text-foreground/75">
                <li>
                  <strong className="font-mono text-[0.78rem] text-foreground">TTF</strong> — system install (macOS{" "}
                  <code className="font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground">~/Library/Fonts</code>, Windows double-click, Linux{" "}
                  <code className="font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground">fc-cache</code>)
                </li>
                <li>
                  <strong className="font-mono text-[0.78rem] text-foreground">TTC</strong> —{" "}
                  <code className="font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground">QuBlackMono.ttc</code> / <code className="font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground">QuBlackSans.ttc</code>: four
                  faces per file, the smaller bundle
                </li>
                <li>
                  <strong className="font-mono text-[0.78rem] text-foreground">WOFF2</strong> —{" "}
                  <code className="font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground">@font-face</code> self-hosting; WOFF2 only, no WOFF1 and no OTF (the outlines
                  are <code className="font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground">glyf</code>)
                </li>
              </ul>
            </div>
          </div>

          <div className="flex h-full flex-col rounded-[18px] border border-border bg-card/70 p-[clamp(1rem,2.5vw,1.5rem)]">
            <p className="max-w-[68ch] mb-2 font-mono text-[0.7rem] tracking-[0.12em] text-muted-foreground uppercase">Install</p>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 overflow-hidden rounded-[10px] border border-ring/40 bg-card/85 py-2 pr-2 pl-3">
                <span className="font-mono text-[0.68rem] text-muted-foreground">macOS</span>
                <code className={"min-w-0 flex-1 overflow-x-auto font-mono text-[0.72rem] whitespace-nowrap text-foreground font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground"}>{installMac}</code>
                <BGCopyButton value={installMac} aria-label="Copy the macOS install command" />
              </div>
              <div className="flex items-center gap-2 overflow-hidden rounded-[10px] border border-ring/40 bg-card/85 py-2 pr-2 pl-3">
                <span className="font-mono text-[0.68rem] text-muted-foreground">Linux</span>
                <code className={"min-w-0 flex-1 overflow-x-auto font-mono text-[0.72rem] whitespace-nowrap text-foreground font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground"}>{installLinux}</code>
                <BGCopyButton value={installLinux} aria-label="Copy the Linux install command" />
              </div>
            </div>
            <p className="max-w-[68ch] mt-4 mb-1 font-mono text-[0.7rem] tracking-[0.12em] text-muted-foreground uppercase">sha256</p>
            <code className={"block overflow-x-auto font-mono text-[0.68rem] break-all text-foreground font-mono border border-yellow/30 bg-yellow/22 px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-foreground"}>{sha256}</code>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <BGButton tone="glow" href={RELEASE_URL}>Download v{VERSION}</BGButton>
              <BGButton tone="ghost" href="https://github.com/gjuoun/qublack">Source</BGButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
