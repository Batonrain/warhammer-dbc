// test/combat/off-hand-threshold.test.mjs
//
// Порог второй руки при атаке двумя оружиями (wdbc-rhr).
//
// Было: module/sheets/attack/dialog.mjs передавал во второй бросок
// `thresholdOf(f)` — ПОЛНЫЙ порог первого оружия (его характеристика, Бонус
// оружия, Свойства, Модификации, Качество, Тренировка) плюс штраф неосновной
// руки. Нагляднее всего на паре «пистолет + меч», под которую и заведена
// скидка Запасного Ствола: удар мечом в левой руке катился против навыка
// СТРЕЛЬБЫ и с бонусами пистолета. Расходилась и однородная пара — два
// пистолета с разным Качеством или модификациями.
//
// Стало: оружейная часть порога считается одной функцией для обеих рук, и в
// бросок второй руки уходит разница. Обстановка (укрытие, стойка цели, приём,
// прицеливание) относится к атаке целиком и остаётся общей — как и было.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { weaponThresholdPart } from "../../module/combat/attack-threshold.mjs";
import { clearRuleSources, registerRuleSource } from "../../module/rules/sources.mjs";

/** Актор с разведёнными WS и BS и без Талантов. */
function hero() {
  clearRuleSources();
  registerRuleSource("test", () => []);
  return {
    system: { characteristics: { ws: { total: 55 }, bs: { total: 30 } } },
    items: []
  };
}

const weapon = (over = {}) => ({
  id: over.id ?? "w", type: "weapon", name: over.name ?? "оружие",
  system: { weaponClass: "melee", weaponType: "primitive", attackBonus: 0,
            properties: [], quality: "common", ...over },
  getFlag: () => undefined
});

describe("оружейная часть порога считается по своему оружию", () => {
  it("рукопашное берёт WS, стрелковое — BS", () => {
    const actor = hero();
    const sword = weapon({ id: "sword" });
    const pistol = weapon({ id: "pistol", weaponClass: "ranged", weaponType: "pistol" });
    expect(weaponThresholdPart(actor, sword,  "ws")).toBe(55);
    expect(weaponThresholdPart(actor, pistol, "bs")).toBe(30);
  });

  it("Бонус оружия — свой у каждой руки", () => {
    const actor = hero();
    expect(weaponThresholdPart(actor, weapon({ attackBonus: 10 }), "ws")).toBe(65);
    expect(weaponThresholdPart(actor, weapon({ attackBonus: -5 }), "ws")).toBe(50);
  });

  it("разница пары «пистолет + меч» — это разница характеристик, а не ноль", () => {
    const actor  = hero();
    const pistol = weapon({ id: "pistol", weaponClass: "ranged", weaponType: "pistol" });
    const sword  = weapon({ id: "sword" });
    // Основная рука — пистолет (BS 30), вторая — меч (WS 55).
    const delta = weaponThresholdPart(actor, sword, "ws")
                - weaponThresholdPart(actor, pistol, "bs");
    expect(delta, "меч во второй руке обязан считаться по WS").toBe(25);
  });

  it("одинаковое оружие в обеих руках разницы не даёт", () => {
    const actor = hero();
    const a = weapon({ id: "a" });
    const b = weapon({ id: "b" });
    expect(weaponThresholdPart(actor, a, "ws") - weaponThresholdPart(actor, b, "ws")).toBe(0);
  });
});
