// The page's atmosphere: drifting palette glows behind the content, and a faint grid that fades out
// from the top. Fixed decoration only — the colours are theme roles, so it follows the palette.
export function BGAtmosphere() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-20 animate-drift bg-[radial-gradient(38vmax_30vmax_at_12%_4%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_62%),radial-gradient(46vmax_34vmax_at_62%_86%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_64%),radial-gradient(30vmax_24vmax_at_20%_76%,color-mix(in_srgb,var(--chart-5)_7%,transparent),transparent_60%)] blur-[8px]"
      ></div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 opacity-55 [background-image:linear-gradient(to_right,color-mix(in_srgb,var(--border)_5.5%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--border)_5.5%,transparent)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(120%_90%_at_50%_0%,#000_25%,transparent_78%)]"
      ></div>
    </>
  );
}
