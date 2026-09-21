// test/rules/legacy-weapon-late-mutations.test.mjs
//
// Три больших находки конца цикла wdbc-1rno.35 (стр. 427) — чистые функции
// module/rules/legacy-weapon.mjs, без Foundry-документов:
//   - Душесвязанное/skilled 7-7: заряженный бонус урона следующему попаданию.
//   - Щит Ненависти/vigilant 9-9: временный AP-щит руки(рук)+торса.
//   - Смертельная Ловушка/vigilant 10-10: раз-в-бой надбавка урона вне Хода.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  soulboundLegacyDamageBonus, consumeSoulboundLegacyBonus,
  legacyHatredShieldApForLocation,
  legacyDeadlyTrapDamageDelta, legacyDeadlyTrapEligible, markLegacyDeadlyTrapUsed
} from "../../module/rules/legacy-weapon.mjs";

function weapon(mutationName, overrides = {}) {
  return {
    id: "w1", name: "Клинок", type: "weapon",
    system: { weaponClass: "melee", legacy: { active: true, mutations: [{ name: mutationName }] }, ...overrides }
  };
}

function actorWithFlag(flagValue) {
  const store = { flag: flagValue };
  return {
    getFlag: (_scope, key) => (key === "legacySoulboundBonus" || key === "legacyHatredShield") ? store.flag : undefined,
    async unsetFlag() { store.flag = undefined; }
  };
}

describe("soulboundLegacyDamageBonus / consumeSoulboundLegacyBonus (Душесвязанное)", () => {
  it("флаг есть, weaponId совпал, hit — возвращает бонус", () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3, willJam: false });
    expect(soulboundLegacyDamageBonus(a, weapon("Душесвязанное"), true)).toBe(3);
  });

  it("нет попадания — 0, флаг не читается вовсе", () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3 });
    expect(soulboundLegacyDamageBonus(a, weapon("Душесвязанное"), false)).toBe(0);
  });

  it("флаг от ДРУГОГО оружия — 0", () => {
    const a = actorWithFlag({ weaponId: "w-other", bonus: 3 });
    expect(soulboundLegacyDamageBonus(a, weapon("Душесвязанное"), true)).toBe(0);
  });

  it("флага нет вовсе — 0", () => {
    const a = actorWithFlag(undefined);
    expect(soulboundLegacyDamageBonus(a, weapon("Душесвязанное"), true)).toBe(0);
  });

  it("consume гасит флаг и не заклинивает, если willJam:false", async () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3, willJam: false });
    const w = weapon("Душесвязанное");
    w.update = async (data) => { w._updated = data; };
    await consumeSoulboundLegacyBonus(a, w, true);
    expect(a.getFlag("warhammer-dbc", "legacySoulboundBonus")).toBeUndefined();
    expect(w._updated).toBeUndefined();
  });

  it("consume гасит флаг И заклинивает оружие, если willJam:true", async () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3, willJam: true });
    const w = weapon("Душесвязанное");
    w.update = async (data) => { w._updated = data; };
    await consumeSoulboundLegacyBonus(a, w, true);
    expect(w._updated).toEqual({ "system.jammed": true });
  });

  it("consume без попадания — ничего не трогает", async () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3, willJam: true });
    const w = weapon("Душесвязанное");
    w.update = async (data) => { w._updated = data; };
    await consumeSoulboundLegacyBonus(a, w, false);
    expect(a.getFlag("warhammer-dbc", "legacySoulboundBonus")).toEqual({ weaponId: "w1", bonus: 3, willJam: true });
    expect(w._updated).toBeUndefined();
  });
});

// legacyHatredShieldArms сама живёт в module/apps/legacy-weapon.mjs, не
// здесь — см. комментарий над legacyHatredShieldApForLocation в
// rules/legacy-weapon.mjs (цикл через rules/hands.mjs → sources.mjs, на
// котором зависает vitest). Её тесты — test/apps/
// legacy-weapon-soulbound-hatred-activate.test.mjs.

describe("legacyHatredShieldApForLocation", () => {
  it("торс — покрыт всегда, если флаг есть", () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3, arms: ["rightArm"] });
    expect(legacyHatredShieldApForLocation(a, "body")).toBe(3);
  });

  it("рука из списка arms — покрыта", () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3, arms: ["rightArm"] });
    expect(legacyHatredShieldApForLocation(a, "rightArm")).toBe(3);
  });

  it("рука НЕ из списка arms — не покрыта", () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3, arms: ["rightArm"] });
    expect(legacyHatredShieldApForLocation(a, "leftArm")).toBe(0);
  });

  it("нога — никогда не покрыта", () => {
    const a = actorWithFlag({ weaponId: "w1", bonus: 3, arms: ["leftArm", "rightArm"] });
    expect(legacyHatredShieldApForLocation(a, "leftLeg")).toBe(0);
  });

  it("флага нет — 0 везде", () => {
    const a = actorWithFlag(undefined);
    expect(legacyHatredShieldApForLocation(a, "body")).toBe(0);
  });
});

describe("legacyDeadlyTrapDamageDelta / legacyDeadlyTrapEligible (Смертельная Ловушка)", () => {
  const actor = (infBonus) => ({ system: { characteristics: { inf: { bonus: infBonus } } } });

  it("дельта = 2×Inf.b − ½Inf.b(окр.▲)", () => {
    expect(legacyDeadlyTrapDamageDelta(actor(5))).toBe(2 * 5 - 3); // ½×5=2.5→3
    expect(legacyDeadlyTrapDamageDelta(actor(4))).toBe(2 * 4 - 2); // ½×4=2
  });

  it("eligible: попадание + вне своего Хода + Мутация + доступность капабилити", () => {
    const a = actor(5);
    const w = weapon("Смертельная Ловушка");
    // isCapabilityAvailable без game.combat — вне боя капабилити всегда доступна
    // (см. module/rules/cooldown.mjs — тот же контракт, что у Скорой Кончины).
    expect(legacyDeadlyTrapEligible({ weapon: w, actor: a, hit: true, isOwnTurn: false })).toBe(true);
  });

  it("свой Ход — не eligible", () => {
    const a = actor(5);
    const w = weapon("Смертельная Ловушка");
    expect(legacyDeadlyTrapEligible({ weapon: w, actor: a, hit: true, isOwnTurn: true })).toBe(false);
  });

  it("нет попадания — не eligible", () => {
    const a = actor(5);
    const w = weapon("Смертельная Ловушка");
    expect(legacyDeadlyTrapEligible({ weapon: w, actor: a, hit: false, isOwnTurn: false })).toBe(false);
  });

  it("нет Мутации на оружии — не eligible", () => {
    const a = actor(5);
    const w = weapon("Другая Мутация");
    expect(legacyDeadlyTrapEligible({ weapon: w, actor: a, hit: true, isOwnTurn: false })).toBe(false);
  });

  it("markLegacyDeadlyTrapUsed делает следующую проверку eligible недоступной в этом же бою", async () => {
    globalThis.game.combat = { id: "combat1" };
    const flags = {};
    const a = { ...actor(5), getFlag: (_s, k) => flags[k], async setFlag(_s, k, v) { flags[k] = v; } };
    const w = weapon("Смертельная Ловушка");
    expect(legacyDeadlyTrapEligible({ weapon: w, actor: a, hit: true, isOwnTurn: false })).toBe(true);
    await markLegacyDeadlyTrapUsed(a);
    expect(legacyDeadlyTrapEligible({ weapon: w, actor: a, hit: true, isOwnTurn: false })).toBe(false);
    globalThis.game.combat = undefined;
  });
});
