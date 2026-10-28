#!/usr/bin/env bun
// components/ui lock gate. Offline by default; the network is needed only to refresh the registry bytes.
//
//   bun run --cwd packages/bigface-business-ui ui-lock
//     ui-lock ok files=63 locked=34 declared=29 markers=1
//   bun run --cwd packages/bigface-business-ui ui-lock --registry <dir>
//     also compares every LOCKED file with <dir>/<name>.tsx byte for byte (from scripts/ui-registry-probe.sh)
//   bun run --cwd packages/bigface-business-ui ui-lock --registry <dir> --write
//     rewrites the manifest sha256s: locked files from <dir>, declared files from their current bytes
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkLock, extractBlocks, sha256, stripBlocks, type Manifest } from "./ui-lock-lib.ts";

const pkg = join(import.meta.dir, "..");
const uiDir = join(pkg, "src/components/ui");
const manifestPath = join(pkg, "src/ui-lock/manifest.json");
const argv = Bun.argv.slice(2);
const opt = (k: string) => {
	const i = argv.indexOf(k);
	return i >= 0 ? argv[i + 1] : undefined;
};
const registryDir = opt("--registry");
const write = argv.includes("--write");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
const files = new Map(
	readdirSync(uiDir)
		.filter((f) => f.endsWith(".tsx"))
		.sort()
		.map((f) => [f, readFileSync(join(uiDir, f), "utf8")] as const),
);

if (write) {
	if (!registryDir) throw new Error("--write needs --registry <dir>");
	for (const [name, entry] of Object.entries(manifest.files)) {
		const text = files.get(name);
		if (text === undefined) throw new Error(name + " is not in components/ui");
		if (entry.state === "locked") {
			const reg = join(registryDir, name);
			if (!existsSync(reg)) throw new Error("registry has no " + name);
			entry.sha256 = sha256(readFileSync(reg, "utf8"));
		} else {
			entry.sha256 = sha256(stripBlocks(text));
		}
	}
	writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
	console.log("ui-lock: manifest rewritten, files=" + files.size);
	process.exit(0);
}

const findings = checkLock(files, manifest);
if (registryDir) {
	for (const [name, entry] of Object.entries(manifest.files)) {
		if (entry.state !== "locked") continue;
		const reg = join(registryDir, name);
		if (!existsSync(reg)) {
			findings.push(name + ": no registry output in " + registryDir);
			continue;
		}
		if (readFileSync(reg, "utf8") !== files.get(name)) findings.push(name + ": differs from the registry output");
	}
}

if (findings.length) {
	for (const f of findings) console.log("ui-lock: FAIL " + f);
	console.log("ui-lock: FAIL (" + findings.length + " finding" + (findings.length === 1 ? "" : "s") + ")");
	process.exit(1);
}
const locked = Object.values(manifest.files).filter((f) => f.state === "locked").length;
const declared = Object.values(manifest.files).length - locked;
const markers = Object.values(manifest.variants).reduce((n, v) => n + v.length, 0);
console.log("ui-lock ok files=" + files.size + " locked=" + locked + " declared=" + declared + " markers=" + markers);
