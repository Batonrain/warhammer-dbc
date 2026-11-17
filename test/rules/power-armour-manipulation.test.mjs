// test/rules/power-armour-manipulation.test.mjs
//
// Силовая Броня (стр. 233, та же глава, что core.nimble, wdbc-x1nz.4):
// «Накладывает штраф –10 на все тонкие манипуляции пальцами. Черный Панцирь
// Космодесантников убирает этот штраф». Список Навыков «тонкой манипуляции» —
// тот же, что уже закреплён для «толстых пальцев» Физиологии Громилы
// (ogryn.brutePhysiology.fineManipulation): Trade, Tech-Use, Security,
// Sleight of Hand.

import { describe, it, expect } from "vitest";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { wearsPowerArmourWithoutBlackCarapace } from "../../module/rules/predicates.mjs";

const actor = ({ items = [], ...system } = {}) => ({
  system: { race: "human", characteristics: {}, ...system }, items
});

const powerArmour = (overrides = {}) =>
  ({ type: "armor", name: "Силовая Броня", system: { equipped: true, armorType: "power", ...overrides } });

const blackCarapace = (installed = true) => ({
  type: "implant", name: "19. Чёрный Панцирь / Black Carapace",
  flags: { "warhammer-dbc": { installed, disabled: false } }
});

const skillTest = (targetActor, skill) => resolveTest({ actor: targetActor, kind: "skill", skill });

describe("wearsPowerArmourWithoutBlackCarapace — предикат", () => {
  it("силовая броня без Чёрного Панциря — true", () => {
    expect(wearsPowerArmourWithoutBlackCarapace(actor({ items: [powerArmour()] }))).toBe(true);
  });

  it("с установленным Чёрным Панцирем — false", () => {
    expect(wearsPowerArmourWithoutBlackCarapace(actor({ items: [powerArmour(), blackCarapace()] }))).toBe(false);
  });

  it("Чёрный Панцирь в инвентаре, но НЕ установлен — всё равно true", () => {
    expect(wearsPowerArmourWithoutBlackCarapace(actor({ items: [powerArmour(), blackCarapace(false)] }))).toBe(true);
  });

  it("броня не надета — false", () => {
    expect(wearsPowerArmourWithoutBlackCarapace(actor({ items: [powerArmour({ equipped: false })] }))).toBe(false);
  });

  it("небронированная (flak) броня — false", () => {
    expect(wearsPowerArmourWithoutBlackCarapace(actor({ items: [powerArmour({ armorType: "flak" })] }))).toBe(false);
  });
});

describe("core.powerArmourFineManipulation — штраф −10 на тонкие манипуляции", () => {
  it("Trade получает штраф-галочку −10 в силовой броне", () => {
    const { mods } = skillTest(actor({ items: [powerArmour()] }), "trade");
    expect(mods).toEqual([expect.objectContaining({ ruleId: "core.powerArmourFineManipulation", value: -10, askOnly: true })]);
  });

  it("Tech-Use, Security и Sleight of Hand — тот же штраф", () => {
    for (const skill of ["techuse", "security", "sleightofhand"]) {
      const { mods } = skillTest(actor({ items: [powerArmour()] }), skill);
      expect(mods).toEqual([expect.objectContaining({ ruleId: "core.powerArmourFineManipulation", value: -10 })]);
    }
  });

  it("навык, не относящийся к тонкой манипуляции (напр. Awareness) — штрафа нет", () => {
    const { mods } = skillTest(actor({ items: [powerArmour()] }), "awareness");
    expect(mods).toEqual([]);
  });

  it("Чёрный Панцирь снимает штраф", () => {
    const { mods } = skillTest(actor({ items: [powerArmour(), blackCarapace()] }), "trade");
    expect(mods).toEqual([]);
  });

  it("без силовой брони штрафа нет", () => {
    const { mods } = skillTest(actor(), "trade");
    expect(mods).toEqual([]);
  });

  it("галочка — askOnly, автоматически не складывается (collectTestMods её не берёт без диалога)", () => {
    const { mods } = skillTest(actor({ items: [powerArmour()] }), "trade");
    expect(mods[0].askOnly).toBe(true);
  });
});
