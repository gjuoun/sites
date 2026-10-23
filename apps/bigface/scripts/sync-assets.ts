// Copies the generated themes into public/ so every download link on the site works, and packs the
// VS Code extension. Run before `astro build` (see package.json).
//
// The themes themselves are not generated here: the palette→themes generator lives in
// gjuoun/bigface-theme, and @gjuoun/bigface-tokens carries its output into this workspace.
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { renderInstaller } from "@gjuoun/bigface-tokens/installer";

const app = join(import.meta.dir, "..");
const themes = join(app, "../../packages/bigface-tokens/themes");
const pub = join(app, "public");

await rm(join(pub, "themes"), { recursive: true, force: true });
await rm(join(pub, "downloads"), { recursive: true, force: true });
await mkdir(join(pub, "downloads"), { recursive: true });
await cp(themes, join(pub, "themes"), { recursive: true });

const vsix = join(pub, "downloads/bigface-theme-0.1.0.vsix");
await $`bunx @vscode/vsce package --no-dependencies -o ${vsix}`
  .cwd(join(themes, "vscode"))
  .quiet();
await Bun.write(join(pub, "install.sh"), renderInstaller());
console.log(`synced themes → public/themes, packed ${vsix}`);
