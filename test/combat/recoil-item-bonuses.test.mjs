// test/combat/recoil-item-bonuses.test.mjs
//
// Плоские бонусы к пределу Отскока в Раунде от Salto/Сальто (+P.b) и Flip
// Belt/Ремень Кувырков (+3м) — wdbc-9wvm, аудит item'ов.

import { describe, it, expect } from "vitest";
import { recoilItemBonus, recoilItemMultiplier } from "../../module/combat/recoil-item-bonuses.mjs";
import { recoilLimit } from "../../module/combat/recoil-pool.mjs";

function actor({ items = [], per = 0, halfMove = 4, absorption = {} } = {}) {
  return {
    type: "character",
    system: {
      characteristics: { per: { total: per, bonus: Math.floor(per / 10) } },
      movement: { halfMove },
      absorption
    },
    items,
    getFlag: () => undefined
  };
}

const talent = name => ({ id: "t1", type: "talent", name });
const gear = name => ({ id: "g1", type: "gear", name });
const meleeWeapon = (name, overrides = {}) =>
  ({ id: "w1", type: "weapon", name, system: { equipped: true, weaponClass: "melee", ...overrides } });

/**
 * Метеоритный молот — так, как он лежит в компендиуме (wdbc-h1bx).
 *
 * ВАЖНО, ПОЧЕМУ НЕ ПРОСТО meteorHammer(): именно так тут и было,
 * и именно поэтому тест оставался зелёным при НЕРАБОЧЕМ коде. Подставное
 * оружие назвали так, как его искал код, — а в компендиуме документ называется
 * «Метеоритный Молот», без английской половины, и совпадения не было никогда.
 * Тест проверял согласие кода с самим собой, а не с данными игры.
 *
 * Теперь опознание идёт по ключу Возможности, который оружие выдаёт, пока
 * надето, — и заглушка несёт то же, что настоящий документ пака.
 */
const meteorHammer = (overrides = {}) => ({
  id: "w1", type: "weapon", name: "Метеоритный Молот",
  system: { equipped: true, weaponClass: "melee", ...overrides },
  flags: { "warhammer-dbc": { mechanics: [{
    id: "g1", operator: "AND",
    entries: [{ id: "e1", kind: "capability", capabilityKey: "weapon.meteorHammer",
                when: { negate: false, conditions: [] } }]
  }] } }
});

/** Броня AP4 на всех локациях (absorption хранит AP+T.b — здесь T.b=0). */
const lightArmor = { head: 4, body: 4, rightArm: 4, leftArm: 4, rightLeg: 4, leftLeg: 4, toughnessBonus: 0 };

describe("recoilItemBonus", () => {
  it("без предметов — 0", () => {
    expect(recoilItemBonus(actor())).toBe(0);
  });

  it("Salto — +P.b м", () => {
    expect(recoilItemBonus(actor({ items: [talent("Salto / Сальто")], per: 47 }))).toBe(4);
  });

  it("Flip Belt — +3м фиксированно", () => {
    expect(recoilItemBonus(actor({ items: [gear("Flip Belt / Ремень Кувырков")] }))).toBe(3);
  });

  it("оба сразу — складываются", () => {
    const a = actor({ items: [talent("Salto / Сальто"), gear("Flip Belt / Ремень Кувырков")], per: 30 });
    expect(recoilItemBonus(a)).toBe(3 + 3); // P.b=3 + Flip Belt 3
  });

  it("Талант того же типа, но другое имя — не матчится", () => {
    expect(recoilItemBonus(actor({ items: [talent("Half-Step / Полушаг")], per: 40 }))).toBe(0);
  });
});

describe("recoilLimit учитывает бонусы предметов", () => {
  it("Salto поднимает предел вне боя тоже (recoilLimit не гейтится Encounter)", () => {
    const a = actor({ items: [talent("Salto / Сальто")], per: 30, halfMove: 4 });
    expect(recoilLimit(a)).toBe(4 + 3);
  });
});

describe("recoilItemMultiplier (Malearius/Малеарий)", () => {
  it("без Таланта — ×1", () => {
    const a = actor({ items: [meteorHammer()], absorption: lightArmor });
    expect(recoilItemMultiplier(a)).toBe(1);
  });

  it("с Талантом, метеоритным молотом и лёгкой бронёй везде — ×2", () => {
    const a = actor({
      items: [talent("Malearius / Малеарий"), meteorHammer()],
      absorption: lightArmor
    });
    expect(recoilItemMultiplier(a)).toBe(2);
  });

  it("с Талантом, но без метеоритного молота в руках — ×1", () => {
    const a = actor({
      items: [talent("Malearius / Малеарий"), meleeWeapon("Меч")],
      absorption: lightArmor
    });
    expect(recoilItemMultiplier(a)).toBe(1);
  });

  it("с Талантом и молотом, но броня AP5+ хоть на одной локации — ×1", () => {
    const a = actor({
      items: [talent("Malearius / Малеарий"), meteorHammer()],
      absorption: { ...lightArmor, leftLeg: 5 }
    });
    expect(recoilItemMultiplier(a)).toBe(1);
  });

  it("T.b не считается бронёй — AP4+T.b3=7 в absorption всё ещё честные AP4", () => {
    const a = actor({
      items: [talent("Malearius / Малеарий"), meteorHammer()],
      absorption: { head: 7, body: 7, rightArm: 7, leftArm: 7, rightLeg: 7, leftLeg: 7, toughnessBonus: 3 }
    });
    expect(recoilItemMultiplier(a)).toBe(2);
  });

  it("recoilLimit множит SPD+бонусы предметов, не ОД-прибавку", () => {
    const a = actor({
      items: [talent("Malearius / Малеарий"), talent("Salto / Сальто"), meteorHammer()],
      per: 30, halfMove: 4, absorption: lightArmor
    });
    // (SPD 4 + Salto P.b 3) × 2 = 14
    expect(recoilLimit(a)).toBe(14);
  });
});
