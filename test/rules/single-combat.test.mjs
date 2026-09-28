// test/rules/single-combat.test.mjs
//
// Бой Один На Один (Палач, корбук стр. 15): +1 Успех на успешные тесты WS/S/A
// в бою один на один; во встречном WS/A «ничья» из-за Сверхъестественной
// Характеристики соперника гаснет у победившего Палача.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { isSingleCombatEngagement, singleCombatExtraDeg, singleCombatIgnoresUnnaturalTie, SINGLE_COMBAT }
  from "../../module/rules/single-combat.mjs";
import { singleCombatEngaged, singleCombatBonus, singleCombatNoUnnaturalTie } from "../../module/combat/single-combat.mjs";
import { resolveOpposed } from "../../module/rules/test-kind.mjs";

describe("isSingleCombatEngagement", () => {
  it("один враг, у врага в контакте только Палач — один на один", () => {
    expect(isSingleCombatEngagement({ enemiesInContact: 1, foeEnemiesInContact: 1 })).toBe(true);
  });
  it("два врага в контакте — нет", () => {
    expect(isSingleCombatEngagement({ enemiesInContact: 2, foeEnemiesInContact: 1 })).toBe(false);
  });
  it("с врагом дерётся ещё союзник Палача — нет", () => {
    expect(isSingleCombatEngagement({ enemiesInContact: 1, foeEnemiesInContact: 2 })).toBe(false);
  });
  it("никого в контакте — нет", () => {
    expect(isSingleCombatEngagement({ enemiesInContact: 0, foeEnemiesInContact: 0 })).toBe(false);
  });
});

describe("singleCombatExtraDeg", () => {
  it("+1 к успешному WS, S и A", () => {
    for (const charKey of ["ws", "s", "ag"]) {
      expect(singleCombatExtraDeg({ engaged: true, success: true, charKey })).toBe(1);
    }
  });
  it("провал, чужая Характеристика или не один на один — 0", () => {
    expect(singleCombatExtraDeg({ engaged: true, success: false, charKey: "ws" })).toBe(0);
    expect(singleCombatExtraDeg({ engaged: true, success: true, charKey: "bs" })).toBe(0);
    expect(singleCombatExtraDeg({ engaged: false, success: true, charKey: "ws" })).toBe(0);
  });
  it("«ничья» гаснет только во встречном WS/A, не S", () => {
    expect(singleCombatIgnoresUnnaturalTie({ engaged: true, charKey: "ws" })).toBe(true);
    expect(singleCombatIgnoresUnnaturalTie({ engaged: true, charKey: "ag" })).toBe(true);
    expect(singleCombatIgnoresUnnaturalTie({ engaged: true, charKey: "s" })).toBe(false);
    expect(singleCombatIgnoresUnnaturalTie({ engaged: false, charKey: "ws" })).toBe(false);
  });
});

describe("singleCombatEngaged — сцена через подменённые зависимости", () => {
  const me = { id: "exec" };
  const foe = { id: "foe" };
  const ally = { id: "ally" };
  const deps = (contacts, hasFlag = true) => ({
    hasFlag: (_a, key) => hasFlag && key === SINGLE_COMBAT,
    tokenOf: a => a,
    enemiesOf: t => contacts[t.id] ?? []
  });

  it("один враг, у него только Палач — бой один на один, +1 Успех", () => {
    const d = deps({ exec: [foe], foe: [me] });
    expect(singleCombatEngaged(me, d)).toBe(true);
    expect(singleCombatBonus(me, { success: true, charKey: "ws" }, d)).toBe(1);
  });
  it("союзник тоже бьёт этого врага — нет", () => {
    expect(singleCombatEngaged(me, deps({ exec: [foe], foe: [me, ally] }))).toBe(false);
  });
  it("без Черты — нет, даже один на один", () => {
    expect(singleCombatEngaged(me, deps({ exec: [foe], foe: [me] }, false))).toBe(false);
  });
  it("без токена на сцене — нет", () => {
    const d = { ...deps({}), tokenOf: () => null };
    expect(singleCombatEngaged(me, d)).toBe(false);
  });
  it("встречный S — «ничья» остаётся", () => {
    expect(singleCombatNoUnnaturalTie(me, "s", deps({ exec: [foe], foe: [me] }))).toBe(false);
    expect(singleCombatNoUnnaturalTie(me, "ws", deps({ exec: [foe], foe: [me] }))).toBe(true);
  });
});

describe("resolveOpposed: noUnnaturalTie у победителя", () => {
  const mine   = { deg: 3, success: true, threshold: 50 };
  const theirs = { deg: 1, success: true, threshold: 60, unnatural: true };

  it("без Черты проигрыш Сверхъестественного гасится до ничьей по Пределу", () => {
    const r = resolveOpposed(mine, theirs);
    expect(r.unnaturalTieBreak).toBe(true);
    expect(r.winner).toBe("theirs"); // Предел соперника выше
  });
  it("Палач с noUnnaturalTie побеждает с полной разницей", () => {
    const r = resolveOpposed({ ...mine, noUnnaturalTie: true }, theirs);
    expect(r.unnaturalTieBreak).toBeUndefined();
    expect(r.winner).toBe("mine");
    expect(r.margin).toBe(2);
  });
  it("признак у ПРОИГРАВШЕГО ничего не меняет", () => {
    const r = resolveOpposed({ deg: 1, success: true, threshold: 50, unnatural: true, noUnnaturalTie: true },
                             { deg: 3, success: true, threshold: 60 });
    expect(r.unnaturalTieBreak).toBe(true);
  });
});
