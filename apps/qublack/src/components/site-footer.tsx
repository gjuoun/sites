// Qu Black's own footer: the 黢 tile beside the wordmark, one line of provenance with both links
// live. The family owns the button and the toggle; the footer is this site's identity.
export interface QuBlackFooterProps {
  repo: string;
}

const LINK = "text-primary no-underline transition-colors duration-200 hover:text-chart-5";

export function QuBlackFooter({ repo }: QuBlackFooterProps) {
  return (
    <footer className="border-t border-border bg-linear-to-b/srgb from-card/20 to-card/85">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] flex flex-wrap items-center justify-between gap-4 py-8">
        <div className="flex items-center gap-[0.7rem] font-display font-bold">
          <span
            className="grid size-10 place-items-center rounded-[11px] bg-card font-mono text-[1.15rem] text-primary shadow-[0_0_0_1px_var(--ring)]"
            aria-hidden="true"
          >
            黢
          </span>
          黢黑 Qu Black
        </div>
        <p className="max-w-[68ch] m-0 text-[0.85rem] text-muted-foreground">
          Hanzi from Source Han Sans via Sarasa, Latin from Recursive Linear ·{" "}
          <br/>
          <a className={LINK} href={repo + "/blob/main/OFL.txt"}>
            SIL OFL 1.1
          </a>{" "}
          ·{" "}
          <a className={LINK} href={repo}>
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
