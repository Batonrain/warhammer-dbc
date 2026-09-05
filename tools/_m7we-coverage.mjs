import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const { CAPABILITIES } = await import("../module/constants/capabilities.mjs");
const { capabilityForm } = await import("../module/constants/capability-forms.mjs");

const used = new Set();
const walk = (dir) => {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name);
    if (n.isDirectory()) { walk(p); continue; }
    if (!n.name.endsWith(".json")) continue;
    const raw = readFileSync(p, "utf8");
    if (!raw.includes('"capabilityKey"')) continue;
    for (const m of raw.matchAll(/"capabilityKey":\s*"([^"]+)"/g)) used.add(m[1]);
  }
};
walk("packs-src");

const paper = [...used].filter(k => CAPABILITIES[k] && !String(CAPABILITIES[k].reader ?? "").trim());
const known = paper.filter(k => capabilityForm(CAPABILITIES[k].label));
console.log("бумажных возможностей, реально выданных предметами:", paper.length);
console.log("из них опознано формой:", known.length, `(${(known.length / paper.length * 100).toFixed(0)}%)`);
const counts = {};
for (const k of paper) { const f = capabilityForm(CAPABILITIES[k].label); counts[f ? f.key : "—не опознано"] = (counts[f ? f.key : "—не опознано"] || 0) + 1; }
Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log("  ", String(v).padStart(3), k));
