import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  themeInitScript,
} from "@gjuoun/bigface-shadcn-ui/lib/themes";
import "../styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "subsdaddy" },
    ],
    // the site has no favicon file: an empty data icon stops the browser asking for /favicon.ico
    links: [{ rel: "icon", href: "data:," }],
    // In <head>, before first paint: a stored mode is applied, so a reload keeps the reader's choice.
    scripts: [{ children: themeInitScript }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The pre-paint script rewrites data-theme/data-mode before hydration, so the document element
    // is intentionally outside React's attribute diff.
    <html lang="en" data-theme={DEFAULT_THEME} data-mode={DEFAULT_MODE} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
