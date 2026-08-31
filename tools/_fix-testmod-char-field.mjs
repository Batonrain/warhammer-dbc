// tools/_fix-testmod-char-field.mjs — разовый фикс: testMod с modScope:"char"
// читает область через entry.rerollChar (см. module/rules/item-rules.mjs
// scopeTarget — «testMod переиспользует rerollChar/skillKey Переброса»), а не
// entry.charKey. 11 записей по всему packs-src (5 из батчей этой сессии,
// 6 — доимплантов, существовавших ДО неё) были записаны с charKey и остались
// на дефолтном rerollChar:"ag" от blankMechEntry — бонус тихо уходил не в ту
// характеристику. Правит rerollChar = charKey везде, где они разошлись.
import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

let fixed = 0;
for (const f of walk("packs-src")) {
  const doc = JSON.parse(fs.readFileSync(f, "utf8"));
  const groups = doc.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(groups)) continue;
  let changed = false;
  for (const g of groups) {
    for (const e of (g.entries || [])) {
      if (e.kind === "testMod" && e.modScope === "char" && e.charKey && e.charKey !== e.rerollChar) {
        console.log("FIX:", doc.name, "|", e.rerollChar, "->", e.charKey);
        e.rerollChar = e.charKey;
        changed = true;
        fixed++;
      }
    }
  }
  if (changed) fs.writeFileSync(f, JSON.stringify(doc, null, 2) + "\n");
}
console.log("Итого исправлено записей:", fixed);
