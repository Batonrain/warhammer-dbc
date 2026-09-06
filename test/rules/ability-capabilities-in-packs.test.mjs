// test/rules/ability-capabilities-in-packs.test.mjs
//
// Ключи Возможностей реально лежат на предметах паков и реально доезжают до
// кода (wdbc-iadw).
//
// Предыдущий тест (ability-by-key) проверяет саму развилку «имя или ключ» на
// подставной записи. Этот проверяет другое и более важное: что записи,
// разложенные по 41 документу packs-src, ЗАПОЛНЕНЫ ПРАВИЛЬНО. Запись с
// опечаткой в поле или с недостающим полем не роняет ничего — она просто не
// даёт возможности, и это ровно та молчаливая поломка, против которой всё
// затевалось.
//
// Поэтому актор здесь собирается из НАСТОЯЩИХ данных пака, а не из подставных,
// и предмету намеренно ломается имя: если ключ не сработает, подстраховки по
// имени не останется и тест покраснеет.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { itemHasName } from "../../module/rules/predicates.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

const packDocs = () => fs.readdirSync(path.join(ROOT, "packs-src"), { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".json"))
  .map(e => path.join(e.parentPath ?? e.path, e.name))
  .filter(f => !path.relative(path.join(ROOT, "packs-src"), f).split(path.sep)[0].startsWith("books"))
  .map(f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } })
  .filter(d => typeof d?.name === "string");

/** Все ключи «ability.*», выданные записями Конструктора в packs-src. */
function abilityKeysInPacks(docs) {
  const out = new Map(); // ключ → документ-носитель
  const dig = (o, doc) => {
    if (Array.isArray(o)) return o.forEach(v => dig(v, doc));
    if (!o || typeof o !== "object") return;
    if (typeof o.capabilityKey === "string" && o.capabilityKey.startsWith("ability."))
      if (!out.has(o.capabilityKey)) out.set(o.capabilityKey, doc);
    for (const v of Object.values(o)) dig(v, doc);
  };
  for (const d of docs) dig(d.flags, d);
  return out;
}

const docs = packDocs();
const granted = abilityKeysInPacks(docs);

describe("ключи ability.* разложены по packs-src", () => {
  it("их там столько же, сколько в реестре", () => {
    const declared = Object.keys(CAPABILITIES).filter(k => k.startsWith("ability."));
    expect(declared.length).toBeGreaterThanOrEqual(38);
    const missing = declared.filter(k => !granted.has(k));
    expect(missing, "эти ключи объявлены в реестре, но ни один предмет пака их не выдаёт").toEqual([]);
  });

  it("у каждого есть читатель — иначе ключ бесполезен", () => {
    const idle = [...granted.keys()].filter(k => !String(CAPABILITIES[k]?.reader ?? "").trim());
    expect(idle).toEqual([]);
  });
});

describe("запись Конструктора на предмете пака и правда выдаёт ключ", () => {
  // Ходим по ВСЕМ ключам, а не по одному образцу: ошибка заполнения бывает
  // в одном документе из сорока, и выборочная проверка её не увидит.
  for (const [key, doc] of granted) {
    it(`«${doc.name}» выдаёт ${key} даже с испорченным именем`, () => {
      // Предмет берётся В РАБОЧЕМ СОСТОЯНИИ: надетым, если он надевается
      // (wdbc-9h7g — носимое снаряжение, оружие и броня отдают Механику
      // только снаряжёнными). Тест про заполненность записей Конструктора, а
      // не про рубильник надетости: у того свои тесты (test/apps/effects,
      // test/rules/gear-worn-mechanics). Без этой строки «Ремень Кувырков»
      // краснел бы не потому, что запись сломана, а потому что он в рюкзаке.
      const item = {
        id: "it1", type: doc.type, name: "ИСПОРЧЕННОЕ ИМЯ",
        system: { ...(doc.system ?? {}), equipped: true }, flags: doc.flags
      };
      const actor = { type: "character", system: { characteristics: {} }, items: [item] };

      // Подстраховки по имени нет — совпасть может только ключ.
      expect(itemHasName(item, doc.name)).toBe(false);
      expect(hasRuleFlag(actor, key)).toBe(true);
    });
  }
});
