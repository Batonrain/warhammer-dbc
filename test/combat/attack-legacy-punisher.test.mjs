// test/combat/attack-legacy-punisher.test.mjs
//
// Каратель/merciless 8-8, Оружие Наследия (wdbc-1rno.35, стр. 428): «За
// каждое успешное попадание оружие получает накапливающийся бонус +3 на
// попадание по НЕМУ до конца боя.» Проверяет проводку: attack.mjs
// инкрементирует счётчик на ЦЕЛИ по id этого оружия, один раз за успешную
// атаку.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { punisherLegacyBonus } from "../../module/rules/legacy-weapon.mjs";

beforeEach(() => { resetCaptured(); setTargets([]); });

function targetWithFlags() {
  const flags = {};
  return {
    name: "Цель",
    system: {},
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; }
  };
}

describe("Каратель: накопление счётчика по цели", () => {
  it("первое попадание — цель получает +3 для этого оружия", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Каратель" }] } });
    weapon.id = "w1";
    const actor = actorFor({ items: [weapon] });
    const target = targetWithFlags();
    setTargets([target]);
    captured.dice = [10, 5]; // попадание, урон 1d10+5
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(punisherLegacyBonus(target, weapon)).toBe(3);
  });

  it("три отдельных попадания тем же оружием — 3, 6, 9", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Каратель" }] } });
    weapon.id = "w1";
    const actor = actorFor({ items: [weapon] });
    const target = targetWithFlags();
    setTargets([target]);
    for (let i = 0; i < 3; i++) {
      captured.dice = [10, 5];
      await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    }
    expect(punisherLegacyBonus(target, weapon)).toBe(9);
  });

  it("промах — счётчик не растёт", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Каратель" }] } });
    weapon.id = "w1";
    const actor = actorFor({ items: [weapon] });
    const target = targetWithFlags();
    setTargets([target]);
    captured.dice = [99]; // промах
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(punisherLegacyBonus(target, weapon)).toBe(0);
  });

  it("оружие без Мутации — счётчик не растёт", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [] } });
    weapon.id = "w1";
    const actor = actorFor({ items: [weapon] });
    const target = targetWithFlags();
    setTargets([target]);
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(punisherLegacyBonus(target, weapon)).toBe(0);
  });

  it("нет цели (game.user.targets пуст) — не падает", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Каратель" }] } });
    weapon.id = "w1";
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await expect(_executeAttackRoll(actor, weapon, "bs", 45, "single", null, {})).resolves.toBeUndefined();
  });
});
