// test/rules/tireless-warrior.test.mjs
//
// wdbc-1rno: Дар Кхорн «Tireless Warrior / Неутомимый Воин» — убийство
// рукопашной атакой в бою: −1 Усталость + 1d5−1 лечения (Раны или урон в
// одну Характеристику, по выбору).

import { describe, it, expect } from "vitest";
import { isTirelessWarriorItem, tirelessWarriorFatigueRelief, tirelessWarriorDamagedCharacteristics,
         tirelessWarriorHealWounds, tirelessWarriorHealCharacteristic } from "../../module/rules/tireless-warrior.mjs";

describe("isTirelessWarriorItem", () => {
  it("узнаёт Дар по книжному двуязычному имени", () => {
    expect(isTirelessWarriorItem({ type: "mutation", name: "Tireless Warrior / Неутомимый Воин" })).toBe(true);
  });
  it("не путает с другим Даром", () => {
    expect(isTirelessWarriorItem({ type: "mutation", name: "Red Sun / Красное Солнце" })).toBe(false);
  });
  it("не путает с Талантом того же имени (если бы был)", () => {
    expect(isTirelessWarriorItem({ type: "talent", name: "Tireless Warrior / Неутомимый Воин" })).toBe(false);
  });
});

describe("tirelessWarriorFatigueRelief", () => {
  it("снимает 1 Усталость", () => {
    expect(tirelessWarriorFatigueRelief({ fatigue: { value: 3 } })).toBe(2);
  });
  it("не уходит ниже 0", () => {
    expect(tirelessWarriorFatigueRelief({ fatigue: { value: 0 } })).toBe(0);
  });
  it("нет fatigue вовсе — не падает, 0", () => {
    expect(tirelessWarriorFatigueRelief({})).toBe(0);
  });
});

describe("tirelessWarriorDamagedCharacteristics", () => {
  it("перечисляет только характеристики с отрицательным мод.", () => {
    const system = { charDamage: { s: -5, t: 0, ag: 3, wp: -2 } };
    const out = tirelessWarriorDamagedCharacteristics(system);
    expect(out.map(o => o.key).sort()).toEqual(["s", "wp"]);
    expect(out.find(o => o.key === "s")).toEqual({ key: "s", label: "Сила", current: -5 });
  });
  it("нет урона вовсе — пустой список", () => {
    expect(tirelessWarriorDamagedCharacteristics({ charDamage: {} })).toEqual([]);
    expect(tirelessWarriorDamagedCharacteristics({})).toEqual([]);
  });
});

describe("tirelessWarriorHealWounds", () => {
  it("прибавляет, клэмп до максимума", () => {
    expect(tirelessWarriorHealWounds({ wounds: { value: 5, max: 12 } }, 4)).toBe(9);
    expect(tirelessWarriorHealWounds({ wounds: { value: 10, max: 12 } }, 4)).toBe(12);
  });
  it("healAmount 0 — без изменений", () => {
    expect(tirelessWarriorHealWounds({ wounds: { value: 5, max: 12 } }, 0)).toBe(5);
  });
});

describe("tirelessWarriorHealCharacteristic", () => {
  it("лечит урон, не превышает 0", () => {
    expect(tirelessWarriorHealCharacteristic({ charDamage: { s: -5 } }, "s", 3)).toBe(-2);
    expect(tirelessWarriorHealCharacteristic({ charDamage: { s: -2 } }, "s", 5)).toBe(0);
  });
  it("не превращает урон в бонус даже с избыточным лечением", () => {
    expect(tirelessWarriorHealCharacteristic({ charDamage: { s: -1 } }, "s", 4)).toBe(0);
  });
});
