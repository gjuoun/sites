// One cell of the home stats band: a big gradient number over a short label.
export interface BGStatProps {
  value: string | number;
  label: string;
}

export function BGStat({ value, label }: BGStatProps) {
  return (
    <div className="flex flex-col gap-[0.15rem] bg-border/72 px-[1.1rem] py-[1.2rem]">
      <strong className="bg-linear-120/srgb from-foreground to-primary bg-clip-text font-display text-[1.9rem] leading-[1.1] font-bold tracking-[-0.03em] text-transparent">
        {value}
      </strong>
      <span className="text-[0.82rem] text-muted-foreground">{label}</span>
    </div>
  );
}
