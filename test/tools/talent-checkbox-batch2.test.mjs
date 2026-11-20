// test/tools/talent-checkbox-batch2.test.mjs
//
// Шаг 3, пачка 2 (18.11.2026): Таланты «по условию» получили записи-галочки
// testMod. Сторож: каждая такая запись превращается в правило броска с
// заполненной областью (пустая область молча ничего не даёт — scopeTarget
// возвращает null), и правило попадает в нужный тест.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") ? [path.join(d, e.name)] : []);
}
const docs = ["talents", "aeldari-talents"].flatMap(p => walk(path.join(ROOT, "packs-src", p)))
  .map(f => JSON.parse(fs.readFileSync(f, "utf8")))
  .filter(d => /^Частично реализовано \(18\.11\.2026\)|^Реализовано \(18\.11\.2026\)/.test(d.system?.notes ?? ""));

const asItem = d => ({ id: d._id, name: d.name, type: d.type, system: d.system, flags: d.flags });

describe("пачки шага 3: галочки Талантов", () => {
  it("записи нашлись", () => expect(docs.length).toBeGreaterThanOrEqual(20));

  for (const d of docs) {
    const entries = (d.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? []);
    const mods = entries.filter(e => e.kind === "testMod");
    if (!mods.length) continue;
    it(`${d.name}: каждая галочка — правило с областью`, () => {
      const rules = rulesFromItemMechanics([asItem(d)]);
      const effects = rules.flatMap(r => r.effects ?? []).filter(fx => fx.kind === "rollBonus");
      expect(effects.length).toBe(mods.length);
      for (const fx of effects) {
        expect(fx.target).toBeTruthy();
        expect(fx.auto).not.toBe(true); // галочка, а не тихая прибавка
        // и только галочка: в бросках без окна (Мораль, Запугивание, Пытки)
        // условие спросить негде — не складывается (rules/roll-mods.mjs)
        expect(fx.askOnly).toBe(true);
      }
    });
  }
});
