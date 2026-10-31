import { BGButton } from "./button.tsx";

// The small "copy" pill. Base.astro's delegated click handler copies data-copy and shows the toast;
// data-swap="off" keeps the label instead of flashing "copied".
export interface BGCopyButtonProps {
  value: string;
  label?: string;
  swap?: "on" | "off";
  className?: string;
  "aria-label"?: string;
}

export function BGCopyButton({ value, label = "copy", swap = "off", className, ...rest }: BGCopyButtonProps) {
  return (
    <BGButton
      tone="copy"
      className={className}
      data-copy={value}
      data-swap={swap}
      data-label={swap === "on" ? label : undefined}
      aria-label={rest["aria-label"]}
    >
      {label}
    </BGButton>
  );
}
