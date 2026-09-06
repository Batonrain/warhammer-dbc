// Бумажные возможности, у которых в подписи названа ЦЕНА В ПУЛЕ.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const { CAPABILITIES } = await import("../module/constants/capabilities.mjs");

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
      if (!used.has(m[1])) used.set(m[1], { name: doc.name, file: p.split("\\").join("/") });
  }
};
walk("packs-src");

// «+1 Бесчестия:» и «потратить Очко Бесчестия» — цена, а не эффект.
const SPEND = /(?:^|[\s,;(])[+]?(\d+)\s+Бесчестия\s*:|потрат(?:ить|ив)\s+Очк[оа]?\s+Бесчестия|за\s+Очко\s+Бесчестия/i;
const GAIN = /восстанавливает\s+\d*\s*Очк|даёт\s+\+\d+\s+Бесчестия|сверх обычного/i;

let n = 0;
for (const [k, src] of used) {
  const c = CAPABILITIES[k];
  if (!c || String(c.reader ?? "").trim()) continue;
  const m = SPEND.exec(c.label);
  if (!m) continue;
  const gain = GAIN.test(c.label);
  n++;
  console.log(`${gain ? "?" : "+"} ${k}`);
  console.log(`   ${src.name}   [${src.file.replace("packs-src/", "")}]`);
  console.log(`   цена: ${m[1] ?? 1} Бесчестия${gain ? "   ← ОСТОРОЖНО: рядом сказано и про ПРИБАВКУ очка" : ""}`);
  console.log(`   ${c.label.slice(0, 170)}\n`);
}
console.log("всего с названной ценой:", n);
