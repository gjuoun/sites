// Section break: a hairline that fades out at both ends.
export function BGDivider({ className }: { className?: string }) {
  return (
    <hr
      className={
        "my-14 h-px border-0 bg-linear-to-r/srgb from-transparent via-border to-transparent" +
        (className ? " " + className : "")
      }
    />
  );
}
