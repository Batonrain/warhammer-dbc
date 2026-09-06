// tools/_roundtrip-check.mjs
//
// Круговорот «сборка → извлечение» для ОДНОГО пака во временную папку, не
// трогая ни packs/, ни packs-src/. Нужен, когда мир запущен и штатный
// npm run packs:build недоступен, а проверить правку исходников надо сейчас:
// CI гоняет ровно этот круговорот и краснеет от расхождения в байт.
//
//   node tools/_roundtrip-check.mjs talents traits

import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abs, PACKS } from "./packs.mjs";
import { docIdsIn } from "./pack-drift.mjs";

const names = process.argv.slice(2);
if (!names.length) throw new Error("укажите паки: node tools/_roundtrip-check.mjs talents traits");

let bad = 0;
for (const name of names) {
  const pack = PACKS.find(p => p.name === name);
  if (!pack) throw new Error(`пак «${name}» не значится в system.json`);
  // Книги собираются НЕ из папки JSON, а из packs-src/books/<slug>.json через
  // tools/book-docs.mjs (там ещё и расстановка @UUID по индексу названий) —
  // этот круговорот их не проверяет и делать вид, что проверил, не должен.
  if (!existsSync(abs(pack.src))) {
    throw new Error(`у пака «${name}» нет папки-исходника ${pack.src} — `
      + "это пак-книга, его круговорот проверяется только полным npm run packs:build");
  }
  const src = abs(pack.src);
  const tmp = mkdtempSync(join(tmpdir(), `dbc-rt-${name}-`));
  const db  = join(tmp, "db");
  const out = join(tmp, "out");
  try {
    await compilePack(src, db, { recursive: true });
    await extractPack(db, out, { clean: true, yaml: false,
      transformName: doc => `${doc._id}.json` });

    // Сравнение по документам, а не по файлам: имена файлов в packs-src
    // обрезаны (tools/unpack.mjs, NAME_LIMIT), здесь они по _id.
    const srcDocs = new Map();
    for (const [id, file] of docIdsIn(src)) srcDocs.set(id, JSON.parse(readFileSync(file, "utf8")));
    let diff = 0;
    for (const [id, doc] of srcDocs) {
      const file = join(out, `${id}.json`);
      if (!existsSync(file)) { console.log(`  ПРОПАЛ ${id} (${doc.name})`); diff++; continue; }
      const back = JSON.parse(readFileSync(file, "utf8"));
      if (JSON.stringify(sorted(doc)) !== JSON.stringify(sorted(back))) {
        console.log(`  РАЗОШЁЛСЯ ${id} (${doc.name})`);
        diff++;
      }
    }
    console.log(`${name}: документов ${srcDocs.size}, расхождений ${diff}`);
    bad += diff;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
process.exit(bad ? 1 : 0);

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])]));
  }
  return value;
}
