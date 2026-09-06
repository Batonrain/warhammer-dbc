// tools/_7qjg-diff.mjs — диагностика wdbc-7qjg.
//
// Что расходится между базой пака, побывавшей в открытом мире, и той же базой,
// собранной прямо сейчас из packs-src. Отвечает на вопрос тикета «ЧТО именно
// ловит отпечаток, если извлечение даёт ноль изменений».
//
//   node tools/_7qjg-diff.mjs vehicles

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abs, PACKS, JOURNAL_PACKS, LIBRARY_PACKS } from "./packs.mjs";

const name = process.argv[2] || "vehicles";
const pack = [...LIBRARY_PACKS, ...JOURNAL_PACKS, ...PACKS].find(p => p.name === name);
if (!pack) throw new Error(`пак «${name}» не значится в system.json`);

async function docsOf(dir) {
  const { ClassicLevel } = await import("classic-level");
  const db = new ClassicLevel(dir, { valueEncoding: "json" });
  await db.open({ createIfMissing: false });
  const out = new Map();
  for await (const [key, value] of db.iterator()) out.set(String(key), value);
  await db.close();
  return out;
}

const tmp = mkdtempSync(join(tmpdir(), "wdbc-7qjg-"));
await compilePack(abs(pack.src ?? `packs-src/${name}`), tmp, { recursive: true });

const live  = await docsOf(abs(pack.dir));
const fresh = await docsOf(tmp);
rmSync(tmp, { recursive: true, force: true });

console.log(`пак ${name}: в базе ${live.size} документов, в свежей сборке ${fresh.size}`);

const fields = new Map(); // «путь поля» → сколько документов расходятся по нему
const sample = new Map();

function walk(a, b, path, key) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const p = path ? `${path}.${k}` : k;
    const va = a?.[k];
    const vb = b?.[k];
    if (JSON.stringify(va) === JSON.stringify(vb)) continue;
    const bothPlain = va && vb && typeof va === "object" && typeof vb === "object"
                   && !Array.isArray(va) && !Array.isArray(vb);
    if (bothPlain) { walk(va, vb, p, key); continue; }
    fields.set(p, (fields.get(p) || 0) + 1);
    if (!sample.has(p)) sample.set(p, { key, live: va, fresh: vb });
  }
}

let onlyLive = 0, onlyFresh = 0;
for (const [key, value] of live) {
  if (!fresh.has(key)) { onlyLive++; continue; }
  walk(value, fresh.get(key), "", key);
}
for (const key of fresh.keys()) if (!live.has(key)) onlyFresh++;

console.log(`только в базе: ${onlyLive}, только в свежей сборке: ${onlyFresh}`);
console.log("расхождения по полям (поле — сколько документов):");
for (const [field, n] of [...fields].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  const s = sample.get(field);
  const cut = v => JSON.stringify(v ?? null)?.slice(0, 120);
  console.log(`  ${field} — ${n}\n      база:   ${cut(s.live)}\n      сборка: ${cut(s.fresh)}\n      (${s.key})`);
}
