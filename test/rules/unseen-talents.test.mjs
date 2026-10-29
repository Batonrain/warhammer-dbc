// test/rules/unseen-talents.test.mjs
//
// wdbc-1rno.2: узнавание Талантов/Черт по имени (Talent/Trait), любая половина
// двуязычного имени — общий фильтр типа проверяется на hasSixthSense; имена
// остальных (Музыка Битвы, Бой Вслепую, Удар в Спину, Снайпер-Убийца)
// охраняет test/rules/talent-name-literals.test.mjs.

import { describe, it, expect } from "vitest";
import {
  hasSixthSense, isKnifeWeapon,
  isBlindsideMarked, markBlindside, consumeBlindsideMark, blindsideUsedThisTurn, clearBlindsideUse
} from "../../module/rules/unseen-talents.mjs";

const actor = (items) => ({ items });

/** Актор с getFlag/setFlag/unsetFlag — для Blindside (метка/разовый гейт). */
function fakeFlagActor() {
  const flags = {};
  return {
    getFlag: (ns, key) => flags[key],
    setFlag: async (ns, key, value) => { flags[key] = value; },
    unsetFlag: async (ns, key) => { delete flags[key]; }
  };
}

describe("hasSixthSense", () => {
  it("талант «Sixth Sense / Шестое Чувство» — true", () => {
    expect(hasSixthSense(actor([{ type: "talent", name: "Sixth Sense / Шестое Чувство" }]))).toBe(true);
  });
  it("русской половиной тоже находит", () => {
    expect(hasSixthSense(actor([{ type: "talent", name: "Шестое Чувство" }]))).toBe(true);
  });
  it("нет предмета — false", () => {
    expect(hasSixthSense(actor([]))).toBe(false);
    expect(hasSixthSense(null)).toBe(false);
  });
  it("предмет другого типа с тем же именем не считается", () => {
    expect(hasSixthSense(actor([{ type: "gear", name: "Sixth Sense / Шестое Чувство" }]))).toBe(false);
  });
});

describe("isKnifeWeapon", () => {
  it("weaponClass melee + meleeCategory Нож — true", () => {
    expect(isKnifeWeapon({ system: { weaponClass: "melee", meleeCategory: "Нож" } })).toBe(true);
  });
  it("другая категория рукопашного — false", () => {
    expect(isKnifeWeapon({ system: { weaponClass: "melee", meleeCategory: "Меч" } })).toBe(false);
  });
  it("не рукопашное — false, даже если meleeCategory зачем-то Нож", () => {
    expect(isKnifeWeapon({ system: { weaponClass: "pistol", meleeCategory: "Нож" } })).toBe(false);
  });
  it("нет предмета/system — false, не бросает", () => {
    expect(isKnifeWeapon(null)).toBe(false);
    expect(isKnifeWeapon({})).toBe(false);
  });
});

describe("Blindside: isBlindsideMarked/markBlindside/consumeBlindsideMark", () => {
  it("нет метки — false", () => {
    expect(isBlindsideMarked(fakeFlagActor(), "Actor.t1")).toBe(false);
  });

  it("markBlindside → isBlindsideMarked true ТОЛЬКО для той же цели", async () => {
    const a = fakeFlagActor();
    await markBlindside(a, "Actor.t1");
    expect(isBlindsideMarked(a, "Actor.t1")).toBe(true);
    expect(isBlindsideMarked(a, "Actor.t2")).toBe(false);
  });

  it("consumeBlindsideMark снимает метку", async () => {
    const a = fakeFlagActor();
    await markBlindside(a, "Actor.t1");
    await consumeBlindsideMark(a);
    expect(isBlindsideMarked(a, "Actor.t1")).toBe(false);
  });

  it("consumeBlindsideMark без метки — ничего не бросает", async () => {
    await expect(consumeBlindsideMark(fakeFlagActor())).resolves.not.toThrow();
  });
});

describe("Blindside: blindsideUsedThisTurn/clearBlindsideUse", () => {
  it("по умолчанию — false", () => {
    expect(blindsideUsedThisTurn(fakeFlagActor())).toBe(false);
  });

  it("после setFlag напрямую (как в script кнопки) — true, clearBlindsideUse сбрасывает", async () => {
    const a = fakeFlagActor();
    await a.setFlag("warhammer-dbc", "blindsideUsedThisTurn", true);
    expect(blindsideUsedThisTurn(a)).toBe(true);
    await clearBlindsideUse(a);
    expect(blindsideUsedThisTurn(a)).toBe(false);
  });
});
