import type * as React from "react";
import { BGEyebrow } from "./eyebrow.tsx";

// Numbered section heading: kicker, title, lead paragraph.
export interface BGSectionHeadProps {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function BGSectionHead({ eyebrow, title, className, children }: BGSectionHeadProps) {
  return (
    <div className={className ? "mb-[1.6rem] max-w-[62ch] " + className : "mb-[1.6rem] max-w-[62ch]"} data-reveal>
      <BGEyebrow>{eyebrow}</BGEyebrow>
      <h2 className="mt-2 mb-[0.7rem]">{title}</h2>
      <p className="max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-muted-foreground">{children}</p>
    </div>
  );
}
