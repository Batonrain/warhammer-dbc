// test/combat/attack-legacy-soulbound-deadly-trap.test.mjs
//
// Проводка attack.mjs для двух больших находок конца цикла wdbc-1rno.35
// (стр. 427):
//   - Душесвязанное/skilled 7-7: заряженный бонус урона потребляется на
//     первом попадании этим же оружием, гасит флаг, заклинивает при
//     willJam.
//   - Смертельная Ловушка/vigilant 10-10: необязательная кнопка карточки
//     урона появляется только вне своего Хода, при доступной раз-в-бой
//     капабилити и Мутации на оружии.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

function withFullFlags(actor, initial = {}) {
  const store = { ...initial };
  actor.getFlag = (scope, key) => store[`${scope}.${key}`];
  actor.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  actor.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  globalThis.game.combat = undefined;
});

describe("Душесвязанное: заряженный бонус потребляется на попадании", () => {
  it("заряженный флаг этого оружия — +bonus к урону, флаг гасится", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Душесвязанное" }] } });
    weapon.id = "w1";
    const actor = withFullFlags(actorFor({ items: [weapon] }),
      { "warhammer-dbc.legacySoulboundBonus": { weaponId: "w1", bonus: 3, willJam: false } });
    captured.dice = [10, 5]; // попадание, 1d10=5 → база 10 (5+S.b.5=10 по умолчанию weaponFor), +3 бонус
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain('data-damage="13"');
    expect(actor.getFlag("warhammer-dbc", "legacySoulboundBonus")).toBeUndefined();
  });

  it("флаг от ДРУГОГО оружия — на этот удар не влияет", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Душесвязанное" }] } });
    weapon.id = "w1";
    const actor = withFullFlags(actorFor({ items: [weapon] }),
      { "warhammer-dbc.legacySoulboundBonus": { weaponId: "w-other", bonus: 3, willJam: false } });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain('data-damage="10"');
  });

  it("промах — бонус не тратится, флаг остаётся заряжен", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Душесвязанное" }] } });
    weapon.id = "w1";
    const actor = withFullFlags(actorFor({ items: [weapon] }),
      { "warhammer-dbc.legacySoulboundBonus": { weaponId: "w1", bonus: 3, willJam: false } });
    captured.dice = [99]; // промах
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(actor.getFlag("warhammer-dbc", "legacySoulboundBonus"))
      .toEqual({ weaponId: "w1", bonus: 3, willJam: false });
  });

  it("willJam:true — оружие заклинивает сразу после попадания, потратившего заряд", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Душесвязанное" }] } });
    weapon.id = "w1";
    const actor = withFullFlags(actorFor({ items: [weapon] }),
      { "warhammer-dbc.legacySoulboundBonus": { weaponId: "w1", bonus: 2, willJam: true } });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(weapon.system.jammed).toBe(true);
  });
});

describe("Смертельная Ловушка: кнопка на карточке урона", () => {
  const infChars = () => ({
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), inf: char(50) }
  });

  it("вне своего Хода (нет game.combat), Мутация есть — кнопка с верной дельтой (2×5−⌈5/2⌉=7)", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Смертельная Ловушка" }] } });
    const actor = actorFor({ items: [weapon], ...infChars() });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain("wh-legacy-deadly-trap-btn");
    expect(card()).toContain('data-delta="7"');
  });

  it("в свой Ход (combatant === этот актор) — кнопки нет", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Смертельная Ловушка" }] } });
    const actor = actorFor({ items: [weapon], ...infChars() });
    globalThis.game.combat = { combatant: { actor } };
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-legacy-deadly-trap-btn");
  });

  it("уже потрачено в этом бою — кнопки нет", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Смертельная Ловушка" }] } });
    const actor = withFullFlags(actorFor({ items: [weapon], ...infChars() }),
      { "warhammer-dbc.usageLimits.legacyDeadlyTrap": { scope: "battle", used: true, battle: "combat1" } });
    globalThis.game.combat = { id: "combat1" };
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-legacy-deadly-trap-btn");
  });

  it("нет Мутации на оружии — кнопки нет", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [] } });
    const actor = actorFor({ items: [weapon], ...infChars() });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-legacy-deadly-trap-btn");
  });
});

describe("Терпение: pending-флаг Караула гасится на фактическом выстреле", () => {
  it("флаг заряжен, стрелковая атака этим оружием — гасится после броска", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Терпение" }] } });
    weapon.id = "w1";
    const actor = withFullFlags(actorFor({ items: [weapon] }), { "warhammer-dbc.legacyPatienceOverwatchPending": true });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(actor.getFlag("warhammer-dbc", "legacyPatienceOverwatchPending")).toBeUndefined();
  });

  it("рукопашная атака тем же оружием — флаг не трогается (стрелковая пометка)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", legacy: { active: true, mutations: [{ name: "Терпение" }] } });
    weapon.id = "w1";
    const actor = withFullFlags(actorFor({ items: [weapon] }), { "warhammer-dbc.legacyPatienceOverwatchPending": true });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { forceMelee: true });
    expect(actor.getFlag("warhammer-dbc", "legacyPatienceOverwatchPending")).toBe(true);
  });
});
