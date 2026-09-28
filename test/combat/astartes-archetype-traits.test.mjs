// test/combat/astartes-archetype-traits.test.mjs
//
// Черты Архетипов Космодесанта в боевом конвейере (корбук, «Архетипы
// Космодесантников», стр. 15):
//   Cold Killer (Избранный)          — d5 Критического Результата дважды;
//   Legionnaire Virtuoso (Искатель)  — +1 кубик урона, наименьший прочь;
//   Sky Predator (Раптор)            — до 2 кубиков урона → Успехи на Натиске с полёта;
//   Single Combat (Палач)            — +1 Успех к успешной рукопашной атаке.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll, rollExtremeDamage } from "../../module/combat/attack.mjs";
import { applyDamageDiceMods } from "../../module/combat/weapon-properties.mjs";
import { isLegionRangedWeapon, LEGIONNAIRE_VIRTUOSO } from "../../module/rules/legionnaire-virtuoso.mjs";
import { COLD_KILLER } from "../../module/rules/cold-killer.mjs";
import { SKY_PREDATOR, activeDieResults, swapDiceFor, isChargeFromFlight } from "../../module/rules/die-swap.mjs";

/** Черта-носитель возможности — как документ Черты из packs-src/traits. */
const capTrait = key => ({
  id: `trait-${key}`, name: key, type: "trait", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } },
  getFlag: () => undefined
});

const card = () => captured.chat.at(-1)?.content ?? "";
const rollWithFace = (result, faces = 10) => ({ terms: [{ faces, results: [{ active: true, result }] }] });

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Legionnaire Virtuoso / Легионер-Виртуоз", () => {
  it("стрелковое оружие Легиона — да; рукопашное или без Legion — нет", () => {
    expect(isLegionRangedWeapon({ weaponClass: "basic", weaponProps: [{ key: "legion" }] })).toBe(true);
    expect(isLegionRangedWeapon({ weaponClass: "thrown", weaponProps: [{ key: "legion" }] })).toBe(true);
    expect(isLegionRangedWeapon({ weaponClass: "melee", weaponProps: [{ key: "legion" }] })).toBe(false);
    expect(isLegionRangedWeapon({ weaponClass: "basic", weaponProps: [{ key: "tearing" }] })).toBe(false);
  });

  it("applyDamageDiceMods: extraDropLowest — +1 кубик, kh исходного числа; складывается с Рвущим", () => {
    expect(applyDamageDiceMods("1d10+9", { extraDropLowest: 1 })).toBe("2d10kh1+9");
    expect(applyDamageDiceMods("1d10+9", { tearing: true, extraDropLowest: 1 })).toBe("3d10kh1+9");
    expect(applyDamageDiceMods("2d10", { extraDropLowest: 1 })).toBe("3d10kh2");
    expect(applyDamageDiceMods("1d10", { extraDropLowest: 0 })).toBe("1d10");
  });

  it("болтер Легиона (Tearing, Legion) в руках Искателя: 1d10 → 3d10kh1", async () => {
    const weapon = weaponFor({ damage: "1d10+9", weaponProps: [{ key: "tearing" }, { key: "legion" }] });
    const actor = actorFor({ items: [weapon, capTrait(LEGIONNAIRE_VIRTUOSO)] });
    captured.dice = [10, 2, 7, 4]; // атака 10; урон 3d10 → 2,7,4 → оставлен 7
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(captured.rolls).toContain("3d10kh1+9");
    expect(card()).toContain('data-damage="16"');
  });

  it("без Черты — прежняя формула Рвущего", async () => {
    const weapon = weaponFor({ damage: "1d10+9", weaponProps: [{ key: "tearing" }, { key: "legion" }] });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 2, 7];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(captured.rolls).toContain("2d10kh1+9");
  });
});

describe("Cold Killer / Хладнокровный Убийца", () => {
  it("атакующий с Чертой — d5 дважды, берётся больший", async () => {
    captured.dice = [2, 4];
    const attacker = actorFor({ items: [capTrait(COLD_KILLER)] });
    const { extremeLevel } = await rollExtremeDamage(rollWithFace(10), {
      wp: { extremeThreshold: 10 }, damageType: "rending", attacker
    });
    expect(extremeLevel).toBe(4);
  });

  it("без Черты — один бросок", async () => {
    captured.dice = [2];
    const attacker = actorFor({ items: [] });
    const { extremeLevel } = await rollExtremeDamage(rollWithFace(10), {
      wp: { extremeThreshold: 10 }, damageType: "rending", attacker
    });
    expect(extremeLevel).toBe(2);
    expect(captured.dice.length).toBe(0);
  });
});

describe("Sky Predator / Хищник Небес", () => {
  it("activeDieResults — только оставленные кубики", () => {
    const roll = { terms: [{ faces: 10, results: [{ result: 2, active: false, discarded: true }, { result: 7, active: true }] }, { number: 5 }] };
    expect(activeDieResults(roll)).toEqual([7]);
  });

  it("swapDiceFor: обычно один кубик, у Хищника Небес два", () => {
    expect(swapDiceFor([3, 8, 5])).toEqual([3]);
    expect(swapDiceFor([3, 8, 5], { skyPredator: true })).toEqual([3, 8]);
  });

  it("isChargeFromFlight: Натиск и в воздухе", () => {
    const inFlightAltitudes = ["ground", "low", "high"];
    expect(isChargeFromFlight({ charge: true, altitude: "low", inFlightAltitudes })).toBe(true);
    expect(isChargeFromFlight({ charge: true, altitude: "landed", inFlightAltitudes })).toBe(false);
    expect(isChargeFromFlight({ charge: false, altitude: "low", inFlightAltitudes })).toBe(false);
  });

  it("Натиск с полёта — две кнопки замены кубика", async () => {
    const weapon = weaponFor({ weaponClass: "melee", damage: "2d10+4", rof_single: 0, rof_semi: 0 });
    const actor = actorFor({ items: [weapon, capTrait(SKY_PREDATOR)], movement: { altitude: "low" } });
    captured.dice = [10, 3, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey: "charge" });
    const html = card();
    expect(html.match(/class="wh-dmg-swap-btn"/g)?.length).toBe(2);
    expect(html).toContain("Хищник Небес");
  });

  it("тот же Натиск на земле — одна кнопка", async () => {
    const weapon = weaponFor({ weaponClass: "melee", damage: "2d10+4", rof_single: 0, rof_semi: 0 });
    const actor = actorFor({ items: [weapon, capTrait(SKY_PREDATOR)], movement: { altitude: "landed" } });
    captured.dice = [10, 3, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey: "charge" });
    expect(card().match(/class="wh-dmg-swap-btn"/g)?.length).toBe(1);
  });

  it("у Рвущего на замену идёт оставленный кубик, а не отброшенный", async () => {
    const weapon = weaponFor({ damage: "1d10+5", weaponProps: [{ key: "tearing" }] });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 2, 8]; // 2d10kh1: 2 отброшен, 8 оставлен
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain('data-base-die="8"');
  });
});
