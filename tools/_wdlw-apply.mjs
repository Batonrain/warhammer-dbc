// Раскладывает метки-ключи по документам packs-src и печатает блок записей для
// реестра (wdbc-wdlw). Идемпотентен: документ с нужным ключом не трогается.
//
//   node tools/_wdlw-apply.mjs            — сухой прогон
//   node tools/_wdlw-apply.mjs --write    — записать
//   node tools/_wdlw-apply.mjs --registry — напечатать блок для capabilities.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import "../test/support/foundry-stub.mjs";
const { itemHasName } = await import("../module/rules/predicates.mjs");
const { blankMechEntry } = await import("../module/apps/mechanics.mjs");
const { ITEM_MARKERS } = await import("./_wdlw-table.mjs");

const DRY = !process.argv.includes("--write");
const REGISTRY = process.argv.includes("--registry");

const filesIn = (dir) => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".json"))
  .map(e => join(e.parentPath ?? e.path, e.name));

const rid = () => {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = ""; for (let i = 0; i < 16; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

const docs = [];
for (const file of filesIn("packs-src")) {
  const rel = relative("packs-src", file).split("\\").join("/");
  if (rel.startsWith("books/")) continue;
  let doc; try { doc = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }
  if (typeof doc?.name === "string") docs.push({ file, rel, doc });
}

const carriers = m => docs.filter(d => d.doc.type === m.type && itemHasName(d.doc, m.name));

if (REGISTRY) {
  const esc = s => JSON.stringify(String(s)).slice(1, -1);
  for (const m of ITEM_MARKERS) {
    const src = carriers(m).map(h => `${h.doc.name} (packs-src/${h.rel.split("/").slice(0, 2).join("/")})`)[0] ?? "";
    console.log(`  "${m.key}": {`);
    console.log(`    label: "${esc(m.label)}",`);
    console.log(`    source: "${esc(src)}",`);
    console.log(`    reader: "${esc(`${m.file} ${m.fn}()`)}"`);
    console.log(`  },`);
  }
  process.exit(0);
}

let touched = 0, already = 0;
const missing = [];
for (const m of ITEM_MARKERS) {
  const hits = carriers(m);
  if (!hits.length) { missing.push(`${m.key} — нет документа «${m.name}» типа ${m.type}`); continue; }
  for (const h of hits) {
    const ns = (h.doc.flags ??= {})["warhammer-dbc"] ??= {};
    const groups = Array.isArray(ns.mechanics) ? ns.mechanics : (ns.mechanics = []);
    if (JSON.stringify(groups).includes(`"${m.key}"`)) { already++; continue; }
    groups.push({ id: rid(), operator: "AND",
      entries: [{ ...blankMechEntry("capability"), id: rid(), capabilityKey: m.key }] });
    if (!DRY) writeFileSync(h.file, JSON.stringify(h.doc, null, 2) + "\n", "utf8");
    console.log(`${DRY ? "[сухой] " : ""}+ ${m.key.padEnd(34)} → ${h.rel}`);
    touched++;
  }
}
console.log(`\nдобавлено: ${touched}, уже было: ${already}, без носителя: ${missing.length}`);
missing.forEach(x => console.log("  " + x));
