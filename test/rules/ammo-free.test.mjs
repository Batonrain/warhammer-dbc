// test/rules/ammo-free.test.mjs
//
// «Выстрел не тратит патрон» — два книжных источника, и путать их нельзя:
//
//  • Рука Смерти (стр. 46) — сросшееся дальнобойное оружие любого класса;
//  • Дар «Рука-Пушка» (корбук, Элитные архетипы, 400 хр) — только пистолет
//    или винтовка, втянутая в предплечье: «…и оно больше не тратит
//    стандартные боеприпасы при выстреле».
//
// Вторая половина Дара («одной рукой без штрафов») была сделана раньше
// возможностью weapon.oneHandedRifle, а эта — нет, и патроны у Одержимого
// продолжали расходоваться (wdbc-6tzk).

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { ammoIsFree, GUN_ARM_CLASSES } from "../../module/rules/ammo-free.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

/** Актор с возможностью Дара — или без неё. */
function hero(withGift) {
  clearRuleSources();
  registerRuleSource("test", () => withGift
    ? [{ id: "gunArm", label: "Дар «Рука-Пушка»", when: {},
         effects: [{ kind: "grantFlag", target: "weapon.noStandardAmmo" }] }]
    : []);
  return { system: {}, items: [] };
}

const gun = (weaponClass, extra = {}) =>
  ({ name: "Тест", type: "weapon", system: { weaponClass, ...extra }, getFlag: () => undefined });

describe("ammoIsFree — Дар «Рука-Пушка»", () => {
  it("пистолет и винтовка у носителя Дара патроны не тратят", () => {
    expect(GUN_ARM_CLASSES).toEqual(["pistol", "basic"]);
    for (const cls of GUN_ARM_CLASSES) {
      expect(ammoIsFree(gun(cls), hero(true)), cls).toBe(true);
    }
  });

  it("без Дара те же пистолет и винтовка тратят патроны как обычно", () => {
    for (const cls of GUN_ARM_CLASSES) {
      expect(ammoIsFree(gun(cls), hero(false)), cls).toBe(false);
    }
  });

  it("тяжёлое и метательное Дар не покрывает — книга говорит про пистолет и винтовку", () => {
    for (const cls of ["heavy", "thrown", "launcher", "stationary"]) {
      expect(ammoIsFree(gun(cls), hero(true)), cls).toBe(false);
    }
  });

  it("мусор вместо оружия или актора не роняет расчёт", () => {
    expect(ammoIsFree(null, hero(true))).toBe(false);
    expect(ammoIsFree(gun("pistol"), null)).toBe(false);
    expect(ammoIsFree({}, hero(true))).toBe(false);
  });
});
