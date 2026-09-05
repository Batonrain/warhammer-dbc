import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const { CAPABILITIES } = await import("../module/constants/capabilities.mjs");
const { capabilityForm } = await import("../module/constants/capability-forms.mjs");

const used = new Map();
const walk = (dir) => {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name);
    if (n.isDirectory()) { walk(p); continue; }
    if (!n.name.endsWith(".json")) continue;
    const raw = readFileSync(p, "utf8");
    if (!raw.includes('"capabilityKey"')) continue;
    let doc; try { doc = JSON.parse(raw); } catch { continue; }
    for (const m of raw.matchAll(/"capabilityKey":\s*"([^"]+)"/g))
      if (!used.has(m[1])) used.set(m[1], { name: doc.name, file: p });
  }
};
walk("packs-src");

const want = process.argv[2] || "immunity";
for (const [k, src] of used) {
  const c = CAPABILITIES[k];
  if (!c || String(c.reader ?? "").trim()) continue;
  const f = capabilityForm(c.label);
  if (f?.key !== want) continue;
  console.log(`── ${k}\n   предмет: ${src.name}\n   ${c.label.slice(0, 260)}\n`);
}
