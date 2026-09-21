// test/apps/legacy-weapon-roll-mutation.test.mjs
//
// rollMutation (module/apps/legacy-weapon.mjs) — Рваное/fearsome 3-4
// (wdbc-1rno.35, стр. 427): единственная из первых Мутаций fearsome,
// требующая разового постоянного изменения weaponProps в момент броска
// самой Мутации (не на каждой атаке), тем же приёмом, что setHistory у
// Наследия Боли/Чумы.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { rollMutation } from "../../module/apps/legacy-weapon.mjs";
import { weaponFor, actorFor } from "../support/combat-fixtures.mjs";

beforeEach(() => resetCaptured());

function legacyWeapon(props = []) {
  return weaponFor({
    weaponClass: "melee", weaponProps: props,
    legacy: { active: true, mutations: [] }
  });
}

describe("rollMutation: Рваное (fearsome 3-4) даёт Tearing/Proven разово", () => {
  it("бросок 3 (Рваное), оружие без Tearing — добавляет Tearing", async () => {
    const item = legacyWeapon([]);
    const actor = actorFor({ corruption: { value: 40 }, items: [item], characteristics: { inf: { bonus: 4, total: 40 } } });
    item.actor = actor;
    captured.nextRoll = 3;
    await rollMutation(item, "fearsome");
    expect(item.system.legacy.mutations[0].name).toBe("Рваное");
    expect(item.system.weaponProps).toEqual([{ key: "tearing" }]);
  });

  it("бросок 3 (Рваное), оружие уже с Tearing — добавляет Proven(½Inf.b)", async () => {
    const item = legacyWeapon([{ key: "tearing" }]);
    const actor = actorFor({ corruption: { value: 40 }, items: [item], characteristics: { inf: { bonus: 5, total: 50 } } });
    item.actor = actor;
    captured.nextRoll = 3;
    await rollMutation(item, "fearsome");
    expect(item.system.weaponProps).toEqual([{ key: "tearing" }, { key: "proven", rating: 3 }]);
  });
});

describe("rollMutation: Разбивающее (fearsome 5-6) даёт Power Field/+2 Pen разово", () => {
  it("бросок 5 (Разбивающее), рукопашное без Power Field — добавляет Power Field, Pen не трогает", async () => {
    const item = legacyWeapon([]);
    item.system.penetration = 3;
    const actor = actorFor({ corruption: { value: 40 }, items: [item] });
    item.actor = actor;
    captured.nextRoll = 5;
    await rollMutation(item, "fearsome");
    expect(item.system.legacy.mutations[0].name).toBe("Разбивающее");
    expect(item.system.weaponProps).toEqual([{ key: "powerField" }]);
    expect(item.system.penetration).toBe(3);
  });

  it("бросок 5, рукопашное УЖЕ с Power Field — Pen +2, свойства не дублирует", async () => {
    const item = legacyWeapon([{ key: "powerField" }]);
    item.system.penetration = 3;
    const actor = actorFor({ corruption: { value: 40 }, items: [item] });
    item.actor = actor;
    captured.nextRoll = 5;
    await rollMutation(item, "fearsome");
    expect(item.system.weaponProps).toEqual([{ key: "powerField" }]);
    expect(item.system.penetration).toBe(5);
  });
});

describe("rollMutation: Ошеломляющее (fearsome 7-7) даёт/повышает Concussive разово", () => {
  it("бросок 7, рукопашное без Concussive — Concussive(½Inf.b)", async () => {
    const item = legacyWeapon([]);
    const actor = actorFor({ corruption: { value: 40 }, items: [item], characteristics: { inf: { bonus: 4, total: 40 } } });
    item.actor = actor;
    captured.nextRoll = 7;
    await rollMutation(item, "fearsome");
    expect(item.system.legacy.mutations[0].name).toBe("Ошеломляющее");
    expect(item.system.weaponProps).toEqual([{ key: "concussive", rating: 2 }]);
  });

  it("бросок 7, стрелковое без Concussive — фиксированный рейтинг 1", async () => {
    const item = weaponFor({ weaponClass: "basic", weaponProps: [], legacy: { active: true, mutations: [] } });
    const actor = actorFor({ corruption: { value: 40 }, items: [item], characteristics: { inf: { bonus: 9, total: 90 } } });
    item.actor = actor;
    captured.nextRoll = 7;
    await rollMutation(item, "fearsome");
    expect(item.system.weaponProps).toEqual([{ key: "concussive", rating: 1 }]);
  });
});

describe("rollMutation: Быстрое (skilled 8-8) — Flexible или swiftDodgePenalty разово", () => {
  it("бросок 8, рукопашное без Flexible — грантует Flexible", async () => {
    const item = legacyWeapon([]);
    const actor = actorFor({ corruption: { value: 40 }, items: [item] });
    item.actor = actor;
    captured.nextRoll = 8;
    await rollMutation(item, "skilled");
    expect(item.system.legacy.mutations[0].name).toBe("Быстрое");
    expect(item.system.weaponProps).toEqual([{ key: "flexible" }]);
    expect(item.system.legacy.swiftDodgePenalty).toBe(false);
  });

  it("бросок 8, рукопашное УЖЕ с Flexible — ставит swiftDodgePenalty, props не дублирует", async () => {
    const item = legacyWeapon([{ key: "flexible" }]);
    const actor = actorFor({ corruption: { value: 40 }, items: [item] });
    item.actor = actor;
    captured.nextRoll = 8;
    await rollMutation(item, "skilled");
    expect(item.system.weaponProps).toEqual([{ key: "flexible" }]);
    expect(item.system.legacy.swiftDodgePenalty).toBe(true);
  });
});

describe("rollMutation: Перебор (fearsome 8-8) доплачивает бонус Наследия до полного Inf.b", () => {
  it("бросок 8 — доплачивает разницу (½Inf.b → Inf.b) в damage/penetration", async () => {
    const item = weaponFor({
      weaponClass: "melee", weaponProps: [], damage: "1d10+6", penetration: 5,
      legacy: { active: true, mutations: [], bonus: 3 } // Inf.b=5 → уже применено +3 (½ окр▲)
    });
    const actor = actorFor({ corruption: { value: 40 }, items: [item], characteristics: { inf: { bonus: 5, total: 50 } } });
    item.actor = actor;
    captured.nextRoll = 8;
    await rollMutation(item, "fearsome");
    expect(item.system.legacy.mutations[0].name).toBe("Перебор");
    expect(item.system.legacy.bonus).toBe(5);
    expect(item.system.penetration).toBe(7);   // 5 + (5-3)
    expect(item.system.damage).toBe("1d10+8"); // +6 + (5-3)
  });
});

describe("rollMutation: Резня (merciless 7-7) даёт/повышает Devastating разово", () => {
  it("бросок 7, без Devastating — Devastating(½Inf.b)", async () => {
    const item = legacyWeapon([]);
    const actor = actorFor({ corruption: { value: 40 }, items: [item], characteristics: { inf: { bonus: 5, total: 50 } } });
    item.actor = actor;
    captured.nextRoll = 7;
    await rollMutation(item, "merciless");
    expect(item.system.legacy.mutations[0].name).toBe("Резня");
    expect(item.system.weaponProps).toEqual([{ key: "devastating", rating: 3 }]);
  });
});

describe("rollMutation: Злобное (merciless 9-9) даёт/повышает Crippling разово", () => {
  it("бросок 9, УЖЕ с Crippling — +1 к рейтингу", async () => {
    const item = legacyWeapon([{ key: "crippling", rating: 2 }]);
    const actor = actorFor({ corruption: { value: 40 }, items: [item], characteristics: { inf: { bonus: 5, total: 50 } } });
    item.actor = actor;
    captured.nextRoll = 9;
    await rollMutation(item, "merciless");
    expect(item.system.legacy.mutations[0].name).toBe("Злобное");
    expect(item.system.weaponProps).toEqual([{ key: "crippling", rating: 3 }]);
  });
});
