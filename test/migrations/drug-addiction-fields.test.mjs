// test/migrations/drug-addiction-fields.test.mjs
//
// wdbc-gyqf2. Копии наркотиков на живых акторах — снимки момента выдачи: нет
// полей комбинированного теста / штрафа без дозы / урона за период и стоят
// прежние неверные числа Зависимости. Миграция догоняет копии по паку «Химия».
// Данные — настоящие JSON packs-src; копия «до правки» получается из записи пака
// возвратом старых значений (CORRECTIONS) и снятием новых полей.

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import {
  CORRECTIONS, buildDrugAddictionIndex, drugAddictionPatch, drugAddictionUpdates
} from "../../module/migrations/drug-addiction-fields.mjs";

const DOCS = allPackDocuments("chemistry").map(({ doc }) => ({
  ...doc, uuid: `Compendium.warhammer-dbc.chemistry.Item.${doc._id}`
}));
const INDEX = buildDrugAddictionIndex(DOCS);
const byEn = en => DOCS.find(d => d.name.split("/").some(h => h.trim() === en));

/** Копия до правки пака: новых полей нет, числа прежние. */
function staleCopy(doc, { withSource = true, id = "it1" } = {}) {
  const system = structuredClone(doc.system);
  const en = doc.name.split("/")[0].trim();
  for (const f of ["testChar2", "testMod2", "penaltyMods", "breakMod", "periodCharDamage"]) delete system.addiction[f];
  Object.assign(system.addiction, CORRECTIONS[en] ?? {});
  return { id, type: doc.type, name: doc.name, system, flags: {}, _stats: withSource ? { compendiumSource: doc.uuid } : {} };
}

function applyPatch(item, patch) {
  for (const [path, v] of Object.entries(patch)) {
    const keys = path.split(".");
    let o = item;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys.at(-1)] = v;
  }
  return item;
}

describe("новые поля Зависимости у старых копий", () => {
  it("Рекаф: комбинированный тест и штраф без дозы приходят из пака; идемпотентно", () => {
    const pack = byEn("Recaf");
    const copy = staleCopy(pack);
    const patch = drugAddictionPatch(copy, INDEX);
    expect(patch).toMatchObject({ "system.addiction.testChar2": "wp", "system.addiction.testMod2": 50 });
    applyPatch(copy, patch);
    expect(copy.system.addiction.penaltyMods).toBe(pack.system.addiction.penaltyMods);
    expect(drugAddictionPatch(copy, INDEX)).toBeNull();
  });

  it("Тиск: урон за период приходит объектом целиком", () => {
    const copy = staleCopy(byEn("Slaught"));
    const patch = drugAddictionPatch(copy, INDEX);
    expect(patch["system.addiction.periodCharDamage"]).toEqual({ stat: "per", formula: "1d5-1" });
  });

  it("правка ГМа главнее пака: уже заполненное поле не перезаписывается", () => {
    const copy = staleCopy(byEn("Recaf"));
    copy.system.addiction.penaltyMods = "all=-5";
    const patch = drugAddictionPatch(copy, INDEX);
    expect(patch["system.addiction.penaltyMods"]).toBeUndefined();
    expect(patch["system.addiction.testChar2"]).toBe("wp");
  });

  it("копия без _stats находится по имени; чужой предмет и не-зависимый препарат не трогаются", () => {
    expect(drugAddictionPatch(staleCopy(byEn("Recaf"), { withSource: false }), INDEX)).not.toBeNull();
    expect(drugAddictionPatch({ id: "w", type: "weapon", name: "Recaf / Рекаф", system: {} }, INDEX)).toBeNull();
    const plain = DOCS.find(d => d.type === "drug" && !d.system.addiction?.hasAddiction);
    expect(drugAddictionPatch({ id: "p", type: "drug", name: plain.name, system: structuredClone(plain.system) }, INDEX)).toBeNull();
  });
}, PACK_SCAN_TIMEOUT);

describe("книжные числа: исправляются только прежние неверные значения", () => {
  it("каждая строка CORRECTIONS: старое значение → значение пака", () => {
    for (const [en, fields] of Object.entries(CORRECTIONS)) {
      const pack = byEn(en);
      expect(pack, en).toBeTruthy();
      const copy = staleCopy(pack);
      applyPatch(copy, drugAddictionPatch(copy, INDEX) ?? {});
      for (const f of Object.keys(fields)) expect(copy.system.addiction[f], `${en}.${f}`).toEqual(pack.system.addiction[f]);
    }
  });

  it("число, которое ГМ поменял сам (не прежнее пака), не трогается", () => {
    const copy = staleCopy(byEn("Mortis"));
    copy.system.addiction.frequency = "3 дня";
    const patch = drugAddictionPatch(copy, INDEX);
    expect(patch?.["system.addiction.frequency"]).toBeUndefined();
  });

  it("обновления набора копий одного владельца", () => {
    const items = [staleCopy(byEn("Rose"), { id: "a" }), staleCopy(byEn("Recaf"), { id: "b" })];
    const ups = drugAddictionUpdates(items, INDEX);
    expect(ups.map(u => u._id)).toEqual(["a", "b"]);
    expect(ups[0]["system.addiction.testMod"]).toBe(-10);
  });
}, PACK_SCAN_TIMEOUT);
