// test/rules/testmod-char-field-consistency.test.mjs
//
// testMod с modScope:"char" резолвит область через entry.rerollChar, не через
// entry.charKey (см. module/rules/item-rules.mjs::scopeTarget — «testMod
// переиспользует rerollChar/skillKey Переброса»). blankMechEntry("testMod")
// даёт rerollChar дефолт "ag" — если автор записи (скрипт или Конструктор)
// поставил только charKey, область молча резолвится в Ловкость вместо
// задуманной характеристики. Обнаружено 30.08.2026: 11 записей по всему
// packs-src (implants + gear) годами/сессией тихо били не в ту характеристику
// (wdbc-sg57, попутная находка). Тест ловит новый рецидив на любом паке.
//
// Дыра, закрытая 31.08.2026 (wdbc-swzz): гейт `e.charKey && ...` пропускал
// записи с ПУСТЫМ charKey — а именно такая запись бьёт больнее всего, потому
// что rerollChar молча остаётся дефолтным "ag" без единого следа в данных,
// откуда взялась характеристика. testMod/modScope:char обязан иметь непустой
// rerollChar независимо от того, задан ли charKey вообще.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

const ROOT = path.resolve(import.meta.dirname, "../../packs-src");

describe("предметы packs-src", () => {
  it("ни один testMod с modScope:char не резолвится в другую характеристику через charKey/rerollChar рассинхрон", () => {
    const offenders = [];
    for (const f of walk(ROOT)) {
      const doc = JSON.parse(fs.readFileSync(f, "utf8"));
      const groups = doc.flags?.["warhammer-dbc"]?.mechanics;
      if (!Array.isArray(groups)) continue;
      for (const g of groups) {
        for (const e of (g.entries ?? [])) {
          if (e?.kind !== "testMod" || e.modScope !== "char") continue;
          if (!e.rerollChar) {
            offenders.push(`${path.relative(ROOT, f)} (${doc.name}): rerollChar пуст (charKey=${e.charKey ?? "—"})`);
          } else if (e.charKey && e.charKey !== e.rerollChar) {
            offenders.push(`${path.relative(ROOT, f)} (${doc.name}): charKey=${e.charKey} rerollChar=${e.rerollChar}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
