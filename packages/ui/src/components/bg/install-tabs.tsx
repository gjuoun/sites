import { Tabs, TabsContent, TabsList, TabsTrigger } from "@gjuoun/bigface-ui/components/ui/tabs";
import { BGButton } from "./button.tsx";

export interface BGInstallTab {
  id: string;
  label: string;
  /** Title in the fake terminal bar, e.g. "sh — install". Omit for no bar. */
  bar?: string;
  command: string;
  note: string;
}

// The install switcher: shadcn Tabs composed in one island (Radix tabs need their parts in one React
// tree). Panels are force-mounted so every command is in the static HTML; inactive ones are hidden.
export function BGInstallTabs({ items }: { items: BGInstallTab[] }) {
  return (
    <Tabs defaultValue={items[0]?.id} className="gap-0">
      <TabsList
        aria-label="Install options"
        className="flex w-full flex-wrap justify-start gap-[0.4rem] rounded-full border border-bf-border bg-bf-border-muted/55 p-[0.4rem] group-data-horizontal/tabs:h-auto"
      >
        {items.map((t) => (
          <TabsTrigger
            key={t.id}
            value={t.id}
            className="h-auto flex-none cursor-pointer rounded-full border-0 px-[0.85rem] py-[0.4rem] text-[0.82rem] leading-[1.65] font-medium text-bf-fg-muted transition-[color,background] duration-200 hover:text-foreground dark:text-bf-fg-muted dark:hover:text-foreground data-active:bg-linear-135/srgb data-active:from-bf-pale-blue data-active:to-bf-blue data-active:text-ink-on-bright dark:data-active:bg-transparent dark:data-active:text-ink-on-bright dark:data-active:hover:text-ink-on-bright group-data-[variant=default]/tabs-list:data-active:shadow-[0_6px_18px_color-mix(in_srgb,var(--bf-blue)_30%,transparent)]"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((t) => (
        <TabsContent
          key={t.id}
          value={t.id}
          forceMount
          className="mt-[0.8rem] text-[1rem] data-[state=inactive]:hidden"
        >
          {t.bar !== undefined && (
            <div className="flex items-center gap-[0.4rem] px-[0.2rem] pb-[0.6rem] font-code text-[0.72rem] text-bf-dim">
              <i className="size-[9px] rounded-full bg-bf-burnt-orange" />
              <i className="size-[9px] rounded-full bg-bf-yellow text-ink-on-bright" />
              <i className="size-[9px] rounded-full bg-bf-green" />
              <span className="ml-2">{t.bar}</span>
            </div>
          )}
          <pre className="m-0 bg-bf-border-muted/85">
            <code>{t.command}</code>
          </pre>
          <div className="flex items-center justify-between gap-4 px-[0.3rem] pt-[0.7rem] pb-[0.1rem] text-[0.8rem] max-[620px]:flex-col max-[620px]:items-start">
            <span className="text-bf-dim">{t.note}</span>
            <BGButton tone="copy" data-copy={t.command} data-swap="off">
              copy
            </BGButton>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
