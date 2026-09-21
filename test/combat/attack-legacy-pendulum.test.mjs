// test/combat/attack-legacy-pendulum.test.mjs
//
// Маятник/vigilant 7-7, Оружие Наследия (wdbc-1rno.35, стр. 427): «Если
// персонаж атаковал этим оружием в свой Ход...» — флаг пишется по факту
// АТАКИ, не гейтится попаданием (книга говорит «атаковал», не «попал»).
// Чтение/трата флага — module/combat/defense.mjs, отдельный тест-файл.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { weaponFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

function actorWithFlags(items = []) {
  const flags = {};
  return {
    id: "a1", name: "Подставной", items,
    system: { characteristics: { ws: { total: 45, bonus: 4 }, bs: { total: 45, bonus: 4 } } },
    getActiveTokens: () => [],
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; }
  };
}

beforeEach(() => { resetCaptured(); });

describe("Маятник: attack.mjs пишет legacyPendulumBonus", () => {
  it("попадание оружием с Мутацией — флаг = порог минус голая характеристика", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Маятник" }] } });
    weapon.id = "w1";
    const actor = actorWithFlags([weapon]);
    captured.dice = [10, 5]; // попадание, урон 1d10+5
    await _executeAttackRoll(actor, weapon, "bs", 60, "single", null, {}); // порог 60, BS.total 45 → модификатор +15
    expect(actor.getFlag("warhammer-dbc", "legacyPendulumBonus")).toEqual({ weaponId: "w1", bonus: 15 });
  });

  it("промах — флаг всё равно пишется (книга: «атаковал», не «попал»)", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Маятник" }] } });
    weapon.id = "w1";
    const actor = actorWithFlags([weapon]);
    captured.dice = [99]; // промах
    await _executeAttackRoll(actor, weapon, "bs", 60, "single", null, {});
    expect(actor.getFlag("warhammer-dbc", "legacyPendulumBonus")).toEqual({ weaponId: "w1", bonus: 15 });
  });

  it("отрицательный модификатор (штрафная атака) — записывается как есть", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Маятник" }] } });
    weapon.id = "w1";
    const actor = actorWithFlags([weapon]);
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 30, "single", null, {}); // порог 30, BS.total 45 → -15
    expect(actor.getFlag("warhammer-dbc", "legacyPendulumBonus")).toEqual({ weaponId: "w1", bonus: -15 });
  });

  it("оружие без Мутации — флаг не пишется", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [] } });
    const actor = actorWithFlags([weapon]);
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 60, "single", null, {});
    expect(actor.getFlag("warhammer-dbc", "legacyPendulumBonus")).toBeUndefined();
  });
});
