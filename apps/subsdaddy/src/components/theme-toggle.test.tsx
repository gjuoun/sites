import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { MODE_STORAGE_KEY } from "@gjuoun/bigface-business-ui/lib/themes";

// The mode lives in data-mode on <html>: these tests drive the toggle the way a reader does and read
// the same two stores the pre-paint script reads — the attribute and the package's storage key.
beforeEach(() => {
  if (!(globalThis as { happyDOM?: unknown }).happyDOM) GlobalRegistrator.register();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.documentElement.dataset.mode = "light";
  localStorage.clear();
});
afterEach(() => localStorage.clear());

const mount = async () => {
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ThemeToggle } = await import("./theme-toggle");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ThemeToggle)));
  const button = document.getElementById("theme-toggle") as HTMLButtonElement;
  return { act, root, host, button };
};

describe("the theme toggle", () => {
  test("it is icon-only, at least 28px, and named for screen readers", async () => {
    const { act, root, host, button } = await mount();
    expect(button.getAttribute("aria-label")).toBe("Dark mode");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.className).toContain("min-h-7");
    expect(button.className).toContain("min-w-7");
    expect((button.textContent ?? "").trim()).toBe("");
    expect(host.querySelectorAll("button")).toHaveLength(1);
    await act(async () => root.unmount());
  });

  test("a click flips data-mode to dark and stores the package's mode key", async () => {
    const { act, root, host, button } = await mount();
    await act(async () => {
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("dark");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await act(async () => root.unmount());
    host.remove();
  });

  test("a second click goes back to light", async () => {
    const { act, root, host, button } = await mount();
    await act(async () => {
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    expect(document.documentElement.dataset.mode).toBe("light");
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("light");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    await act(async () => root.unmount());
    host.remove();
  });
});
