// Утилитарные мехадендриты (wdbc-qbyvc): галочки бонусов к тестам при
// Mechadendrite Use (Utility) и +5 к Крафту за каждый Мехатендрил.
import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { mechatendrilCraftBonus } from "../../module/rules/mechadendrites.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const DIR = "packs-src/implants/Адептус_Механикус/Мехадендриты";
const asItem = doc => ({ id: doc._id, name: doc.name, type: doc.type, system: doc.system, flags: doc.flags });
const use = spec => ({ type: "talent", name: "Mechadendrite Use / Использование Мехадендритов", system: { specialization: spec } });
const medicae = asItem(packDocById(DIR, "PSIz8YNULERaJjvo"));

describe("Медицинский Мехадендрит", () => {
  it("с Mechadendrite Use (Utility) — галочка +10 в окне Medicae", () => {
    const actor = { items: [use("Utility")], system: {} };
    const mods = rollModsFromRules(rulesFromItemMechanics([medicae], () => true, actor), { actor, kind: "skill", skill: "medicae", char: "int" });
    expect(mods.map(m => m.value)).toContain(10);
  });
  it("без обучения Utility — бонуса нет", () => {
    const actor = { items: [use("Weapon")], system: {} };
    expect(rulesFromItemMechanics([medicae], () => true, actor)).toEqual([]);
  });
});

describe("Мехатендрил: +5 к Крафту за каждый", () => {
  const tendril = { type: "implant", name: "Mechatendril / Мехатендрил", system: {}, flags: { "warhammer-dbc": { installed: true } } };
  it("два установленных при обучении — +10, на Исследованиях и без обучения — 0", () => {
    expect(mechatendrilCraftBonus({ items: [use("Utility"), tendril, tendril] })).toBe(10);
    expect(mechatendrilCraftBonus({ items: [use("Utility"), tendril] }, "research")).toBe(0);
    expect(mechatendrilCraftBonus({ items: [tendril] })).toBe(0);
  });
});

import { mechadendriteCount, dendriteFocusAttackBonus, dendriteAttackModes, dendriteAttackBlock,
  DENDRITE_FOCUS_FLAG, DENDRITE_REACTION_FLAG } from "../../module/rules/mechadendrites.mjs";

describe("мехадендриты в бою (2qtgp)", () => {
  const dendrite = (id) => ({ id, type: "weapon", name: `Боевой мехадендрит ${id}`, system: { profileLabel: "Мехадендрит" } });
  const sword = { id: "sw", type: "weapon", name: "Меч", system: {} };
  const talent = { id: "t1", type: "talent", name: "Mechadendrite Use (Weapon)", system: {} };
  const mk = (items, flags = {}) => {
    const arr = [...items];
    arr.get = id => arr.find(i => i.id === id);
    return { items: arr, system: { characteristics: {} }, flags: { "warhammer-dbc": flags },
      getFlag: (s, k) => flags[k] };
  };

  it("число дендритов — по оружию, если имплантов нет", () => {
    expect(mechadendriteCount(mk([dendrite("a"), dendrite("b"), dendrite("c"), sword]))).toBe(3);
  });

  it("сосредоточение даёт ceil(X/2)−1 атак сверх одной, только с флагом и Талантом", () => {
    const items = [talent, dendrite("a"), dendrite("b"), dendrite("c"), dendrite("d"), dendrite("e")];
    expect(dendriteFocusAttackBonus(mk(items))).toBe(0);
    expect(dendriteFocusAttackBonus(mk(items, { [DENDRITE_FOCUS_FLAG]: true }))).toBe(2);
    expect(dendriteFocusAttackBonus(mk(items.slice(1), { [DENDRITE_FOCUS_FLAG]: true }))).toBe(0);
  });

  it("режимы — только дендритом и с Талантом", () => {
    expect(dendriteAttackModes(mk([talent]), dendrite("a"))).toEqual(["focus", "reaction"]);
    expect(dendriteAttackModes(mk([talent]), sword)).toEqual([]);
    expect(dendriteAttackModes(mk([]), dendrite("a"))).toEqual([]);
  });

  it("сосредоточен — обычным оружием нельзя; после удара мечом сосредоточиться нельзя", () => {
    const a = dendrite("a");
    expect(dendriteAttackBlock(mk([talent, a, sword], { [DENDRITE_FOCUS_FLAG]: true }), sword, "")).toMatch(/только они/);
    expect(dendriteAttackBlock(mk([talent, a, sword]), a, "focus", ["sw"])).toMatch(/уже атаковал не мехадендритом/);
    expect(dendriteAttackBlock(mk([talent, a, sword]), a, "focus", [])).toBe("");
  });

  it("за Реакцию одним дендритом — раз в Ход", () => {
    const a = dendrite("a");
    expect(dendriteAttackBlock(mk([talent, a]), a, "reaction")).toBe("");
    expect(dendriteAttackBlock(mk([talent, a], { [DENDRITE_REACTION_FLAG]: ["a"] }), a, "reaction")).toMatch(/уже атаковал/);
  });
});
