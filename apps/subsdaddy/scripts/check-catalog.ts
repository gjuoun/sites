import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFileSchema } from "../src/data/catalog";

const APP = resolve(import.meta.dir, "..");
const raw = JSON.parse(readFileSync(join(APP, "data", "catalog.json"), "utf8"));
const f = catalogFileSchema.parse(raw);
const catalog = f.rows.filter((r) => r.status === "catalog").length;
const excluded = f.rows.filter((r) => r.status === "excluded").length;
console.log("catalog=" + catalog + " excluded=" + excluded + " priced=" + f.rows.filter((r) => r.price_month_usd !== null || r.price_native !== null).length);
