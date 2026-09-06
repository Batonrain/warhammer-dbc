// Печатает блок записей для module/constants/capabilities.mjs по таблице.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import "../test/support/foundry-stub.mjs";
const { itemHasName } = await import("../module/rules/predicates.mjs");
const { ABILITIES } = await import("./_iadw-table.mjs");

const filesIn = (dir, ext) => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(ext))
  .map(e => join(e.parentPath ?? e.path, e.name));

const docs = [];
for (const f of filesIn("packs-src", ".json")) {
  const rel = relative("packs-src", f).split("\\").join("/");
  if (rel.startsWith("books/")) continue;
  let d; try { d = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
  if (typeof d?.name === "string") docs.push({ rel, doc: d });
}
const esc = s => JSON.stringify(String(s)).slice(1, -1);
for (const ab of ABILITIES) {
  const kinds = Array.isArray(ab.types) ? ab.types : [ab.types];
  const hits = docs.filter(d => kinds.includes(d.doc.type) && itemHasName(d.doc, ab.name));
  const src = hits.map(h => `${h.doc.name} (packs-src/${h.rel.split("/").slice(0, 2).join("/")})`)[0] ?? "";
  console.log(`  "${ab.key}": {`);
  console.log(`    label: "${esc(ab.label)}",`);
  console.log(`    source: "${esc(src)}",`);
  console.log(`    reader: "${esc(ab.reader)}"`);
  console.log(`  },`);
}
