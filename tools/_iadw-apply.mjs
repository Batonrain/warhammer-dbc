// Раскладывает записи Конструктора «Возможность» по документам packs-src
// (wdbc-iadw). Идемпотентен: документ, уже несущий нужный ключ, не трогается.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import "../test/support/foundry-stub.mjs";
const { itemHasName } = await import("../module/rules/predicates.mjs");
const { blankMechEntry } = await import("../module/apps/mechanics.mjs");
const { ABILITIES } = await import("./_iadw-table.mjs");

const DRY = !process.argv.includes("--write");

const filesIn = (dir, ext) => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(ext))
  .map(e => join(e.parentPath ?? e.path, e.name));

const rid = () => {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = ""; for (let i = 0; i < 16; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

const docs = [];
for (const f of filesIn("packs-src", ".json")) {
  const rel = relative("packs-src", f).split("\\").join("/");
  if (rel.startsWith("books/")) continue;
  let d; try { d = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
  if (typeof d?.name === "string") docs.push({ file: f, rel, doc: d });
}

const hasKey = (doc, key) => JSON.stringify(doc.flags?.["warhammer-dbc"]?.mechanics ?? []).includes(`"${key}"`);

let touched = 0, skipped = 0, missing = [];
for (const ab of ABILITIES) {
  const kinds = Array.isArray(ab.types) ? ab.types : [ab.types];
  const hits = docs.filter(d => kinds.includes(d.doc.type) && itemHasName(d.doc, ab.name));
  if (!hits.length) { missing.push(`${ab.key} — нет носителя «${ab.name}» типа ${kinds.join("/")}`); continue; }
  for (const h of hits) {
    if (hasKey(h.doc, ab.key)) { skipped++; continue; }
    const entry = { ...blankMechEntry("capability"), id: rid(), capabilityKey: ab.key };
    const flags = h.doc.flags ??= {};
    const ns = flags["warhammer-dbc"] ??= {};
    const groups = Array.isArray(ns.mechanics) ? ns.mechanics : (ns.mechanics = []);
    groups.push({ id: rid(), operator: "AND", entries: [entry] });
    if (!DRY) writeFileSync(h.file, JSON.stringify(h.doc, null, 2) + "\n", "utf8");
    console.log(`${DRY ? "[сухой] " : ""}+ ${ab.key.padEnd(34)} → ${h.rel}`);
    touched++;
  }
}
console.log(`\nдобавлено: ${touched}, уже было: ${skipped}, без носителя: ${missing.length}`);
missing.forEach(m => console.log("  " + m));
