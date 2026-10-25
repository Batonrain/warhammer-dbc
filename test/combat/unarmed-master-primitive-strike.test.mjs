// test/combat/unarmed-master-primitive-strike.test.mjs
//
// Unarmed Master / Безоружный Мастер (стр. 62; Sahara 3-eddb): «Его безоружные
// атаки теряют свойство Primitive». Основная атака (attack.mjs) это уже делала;
// Ответный удар и ответ на Силовое поле идут другим путём — rollStrikeOn
// (combat/unarmed-combat.mjs) — и брали Primitive кулака из свойств оружия.
// Здесь: rollStrikeOn передаёт в урон primitive:false, когда кулаком бьёт мастер
// (wielder), и primitive:true во всех остальных случаях.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";

const applied = [];
vi.mock("../../module/combat/damage.mjs", async importOriginal => ({
  ...(await importOriginal()),
  applyDamageToActor: vi.fn(async (_target, data) => { applied.push(data); })
}));

const { rollStrikeOn, performUnarmedRiposte } = await import("../../module/combat/unarmed-combat.mjs");

const MASTER = { id: "um", name: "Unarmed Master / Безоружный Мастер", type: "talent", system: {} };

function fighter(items = [], uuid = "Actor.x") {
  const a = actorFor({ items });
  a.uuid = uuid;
  a.name = uuid;
  a.items.contents = a.items;
  return a;
}

/** Кулак: интегральная атака со свойством Primitive. */
function primitiveFist() {
  const w = weaponFor({ weaponClass: "melee", balance: -1, equipped: true, damage: "1d5", damageType: "impact",
                        grips: "Кист", meleeCategory: "Кулаки", weaponProps: [{ key: "primitive" }] },
                      { id: "fist", name: "Кулак" });
  w.uuid = "Item.fist";
  w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
  return w;
}

beforeEach(() => { resetCaptured(); applied.length = 0; });

describe("rollStrikeOn: Primitive кулака и Безоружный Мастер", () => {
  it("обычный боец: кулак бьёт с Primitive (регрессия)", async () => {
    const hitter = fighter([], "Actor.plain");
    await rollStrikeOn(fighter([], "Actor.victim"), { weapon: primitiveFist(), sbActor: hitter, wielder: hitter, location: "arm" });
    expect(applied.at(-1).primitive).toBe(true);
  });

  it("Безоружный Мастер: тот же кулак бьёт без Primitive", async () => {
    const master = fighter([MASTER], "Actor.master");
    await rollStrikeOn(fighter([], "Actor.victim"), { weapon: primitiveFist(), sbActor: master, wielder: master, location: "arm" });
    expect(applied.at(-1).primitive).toBe(false);
  });

  it("Ответный удар: Primitive снимает Талант ХОЗЯИНА кулака, а не носителя S.b (бьёт с S.b атакующего)", async () => {
    const master = fighter([MASTER], "Actor.master");
    const fist = primitiveFist();
    master.items.get = id => (id === "fist" ? fist : undefined);
    master.isOwner = true;
    const attacker = fighter([], "Actor.attacker");
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : null);
    await performUnarmedRiposte(master, { weaponId: "fist", attackerUuid: attacker.uuid });
    expect(applied.at(-1).primitive).toBe(false);
  });

  it("Ответный удар обычного бойца кулаком — Primitive остаётся", async () => {
    const plain = fighter([], "Actor.plain");
    const fist = primitiveFist();
    plain.items.get = id => (id === "fist" ? fist : undefined);
    plain.isOwner = true;
    const attacker = fighter([MASTER], "Actor.attackerMaster");   // Талант у атакующего, чей S.b — не его кулак
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : null);
    await performUnarmedRiposte(plain, { weaponId: "fist", attackerUuid: attacker.uuid });
    expect(applied.at(-1).primitive).toBe(true);
  });
});
