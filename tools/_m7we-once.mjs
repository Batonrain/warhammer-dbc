import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const { CAPABILITIES } = await import("../module/constants/capabilities.mjs");
const { capabilityForm } = await import("../module/constants/capability-forms.mjs");

const used = new Map();
const walk = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!n.endsWith(".json")) continue;
    const raw = readFileSync(p, "utf8");
    if (!raw.includes('"capabilityKey"')) continue;
    let doc; try { doc = JSON.parse(raw); } catch { continue; }
    for (const m of raw.matchAll(/"capabilityKey":\s*"([^"]+)"/g))
      if (!used.has(m[1])) used.set(m[1], { name: doc.name, file: p, doc });
  }
};
walk("packs-src");

for (const [k, src] of used) {
  const c = CAPABILITIES[k];
  if (!c || String(c.reader ?? "").trim()) continue;
  if (capabilityForm(c.label)?.key !== "oncePer") continue;
  console.log(`── ${k}`);
  console.log(`   ${src.name}`);
  console.log(`   ${c.label}`);
  console.log(`   ${src.file}\n`);
}
