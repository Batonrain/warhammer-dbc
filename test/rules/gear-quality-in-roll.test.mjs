// test/rules/gear-quality-in-roll.test.mjs
//
// Качество «прочего снаряжения» (core, стр. 165): «Обычно уникальное для каждого,
// но если не указано, то: Poor.Q −10 / Good.Q +5 / Best.Q +10 на тесты с этим
// снаряжением». Тест «с этим снаряжением» — тот, где предмет даёт бонус
// (запись testMod): качество идёт отдельной строкой рядом, один раз на предмет.
// Если у предмета качество прописано своим текстом (system.qualityEffects),
// общая таблица не применяется — «если не указано».

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { gearQualityRollMod } from "../../module/constants/quality.mjs";

const item = (quality, over = {}) => ({
  id: "g1", name: "Ауспекс", type: "gear",
  system: { quality, ...(over.system || {}) },
  flags: { "warhammer-dbc": { mechanics: [{ id: "grp", operator: "AND", entries: [
    { id: "e1", kind: "testMod", modScope: "all", value: 10, ...(over.entry || {}) },
    ...(over.extraEntries || [])
  ] }] } },
  getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
});

const modsOf = (it, opts) => rollModsFromRules(rulesFromItemMechanics([it]), { kind: "skill", skill: "awareness" }, opts);

describe("качество снаряжения в броске", () => {
  it("бонус снаряжения + строка качества, отмеченная заранее", () => {
    const mods = modsOf(item("good"));
    expect(mods.map(m => m.value)).toEqual([10, 5]);
    expect(mods[1].label).toContain("Good.Q");
    expect(mods[1].preChecked).toBe(true);
  });
  it("Poor.Q — −10", () => {
    expect(modsOf(item("poor")).map(m => m.value)).toEqual([10, -10]);
  });
  it("Обычное качество — строки нет", () => {
    expect(modsOf(item("common")).map(m => m.value)).toEqual([10]);
  });
  it("две записи одного предмета — качество один раз", () => {
    const mods = modsOf(item("best", { extraEntries: [{ id: "e2", kind: "testMod", modScope: "all", value: 5 }] }));
    expect(mods.filter(m => m.ruleId.startsWith("quality.")).length).toBe(1);
  });
  it("запись «сама» (modAuto) отдаёт качество в автоматические", () => {
    const it2 = item("poor", { entry: { modAuto: true } });
    expect(modsOf(it2, { auto: true }).map(m => m.value)).toEqual([10, -10]);
    expect(modsOf(it2).length).toBe(0);
  });
  it("у предмета своё качество своим текстом — общая таблица не действует", () => {
    const it2 = item("good", { system: { quality: "good", qualityEffects: { good: "+10 к Awareness" } } });
    expect(gearQualityRollMod(it2)).toBe(null);
    expect(modsOf(it2).map(m => m.value)).toEqual([10]);
  });
});

describe("исключения общей таблицы", () => {
  it("импланты и кибернетика — своё качество по предмету, общей таблицы нет", () => {
    expect(gearQualityRollMod({ type: "implant", system: { quality: "poor" } })).toBe(null);
    expect(gearQualityRollMod({ type: "cybernetic", system: { quality: "good" } })).toBe(null);
  });
});

import { quantityUnitNote } from "../../module/rules/requisition.mjs";

describe("Количество патронов в Реквизиции — магазины (стр. 165)", () => {
  it("у боеприпасов подпись про магазин, у прочего пусто", () => {
    expect(quantityUnitNote({ type: "ammo" })).toContain("1 стандартный магазин");
    expect(quantityUnitNote({ type: "gear" })).toBe("");
    expect(quantityUnitNote(null)).toBe("");
  });
});
