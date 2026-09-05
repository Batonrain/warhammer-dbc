// test/rules/item-markers-in-packs.test.mjs
//
// Метки-ключи реально лежат на документах паков и реально опознаются
// (wdbc-wdlw).
//
// Тот же приём доказательства, что у возможностей актора
// (ability-capabilities-in-packs): актор и предмет собираются из НАСТОЯЩИХ
// данных пака, а имени предмета намеренно ломают — если ключ заполнен неверно,
// подстраховки не останется и тест покраснеет. Проверяются все метки, а не
// образец: ошибка заполнения бывает в одном документе из пятнадцати.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { itemHasKey, itemIs } from "../../module/rules/item-marker.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { ITEM_MARKERS } from "../../tools/_wdlw-table.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

const docs = fs.readdirSync(path.join(ROOT, "packs-src"), { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".json"))
  .map(e => path.join(e.parentPath ?? e.path, e.name))
  .filter(f => !path.relative(path.join(ROOT, "packs-src"), f).split(path.sep)[0].startsWith("books"))
  .map(f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } })
  .filter(d => d && typeof d.name === "string");

const carrierOf = (m) => docs.find(d => d.type === m.type && itemHasKey(d, m.key));

describe("метки предметов заведены и в реестре, и в паках", () => {
  it("у каждой метки есть запись в реестре и читатель", () => {
    const bad = ITEM_MARKERS.filter(m => {
      const c = CAPABILITIES[m.key];
      return !c || !String(c.reader ?? "").trim();
    }).map(m => m.key);
    expect(bad, "нет записи в реестре либо не назван читатель").toEqual([]);
  });

  for (const m of ITEM_MARKERS) {
    it(`${m.key} — метка на документе пака опознаётся с испорченным именем`, () => {
      const doc = carrierOf(m);
      expect(doc, `ни один документ типа ${m.type} не несёт ${m.key}`).toBeTruthy();

      const broken = { ...doc, name: "ИСПОРЧЕННОЕ ИМЯ" };
      // Подстраховки по имени нет — совпасть может только ключ.
      expect(itemIs(broken, m.type, m.key, m.name)).toBe(true);
      // И чужой тип её не спасёт.
      expect(itemIs({ ...broken, type: "gear" }, m.type, m.key, m.name)).toBe(false);
    });
  }
});
