import { writeFile } from "node:fs/promises";
import { collectWeatherEvidence } from "./weather-evidence.mjs";
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, "").split(/=(.*)/s).slice(0, 2)));
if (!args.base || !("cache-only" in args)) throw new Error("Require --base=URL --cache-only; this evidence runner never calls suppliers.");
const base = new URL(args.base);
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Require an HTTP(S) base without credentials.");
const date = args.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date) throw new Error("Require a valid calendar date.");
const evidence = await collectWeatherEvidence({ base, date });
if (args.output) await writeFile(args.output, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
// NOT_RUN cache misses/device/science are never promoted by HTTP 200 or fixtures.
