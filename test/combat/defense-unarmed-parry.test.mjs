// test/combat/defense-unarmed-parry.test.mjs
//
// Безоружное Парирование / Кулак.Б (core.json, раздел «Безоружный Бой»):
// «Невооруженный персонаж получает штраф –20 на Парирование полноценного
// рукопашного оружия.» «Кулак.Б (бронированный) может Парировать рукопашное
// оружие, наносящее R Dmg (со свойством Power Field – также оружие, наносящее
// E Dmg), считаясь полноценным оружием... не получает урон от успешного
// Парирования его атаки другим оружием, если только оно не привело к
// разрушению кулака свойством Power Field.» И: «Если силовое оружие
// «уничтожает» безоружную атаку, это считается попаданием этим оружием в
// атакующую часть тела с 1 Успехом (используя S.b. атакующего...), но сама
// безоружная атака остается доступной.»

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry } from "../../module/combat/defense.mjs";

const DEFAULT_SOURCES = getRuleSources();

// Ранг «Ветеран» (+30) — с −20 (безоружное Парирование) и −10 (баланс кулака)
// порог всё ещё положительный и успех гарантирован (captured.dice=[10]).
function attacker(overrides = {}) {
  const a = actorFor({ skills: { parry: { rank: "expert" } }, ...overrides });
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.update = async () => {};
  a.items.contents = a.items; // applyDamageToActor читает actor.items.contents (_rollActiveShield)
  return a;
}

/** Голый кулак — интегральная атака без подтипа (не Кулак.Б). */
function bareFist() {
  const w = weaponFor({ weaponClass: "melee", balance: -1, equipped: true, damage: "1d5-2" }, { id: "fist" });
  w.type = "weapon";
  w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
  return w;
}

/** Кулак.Б — та же интегральная атака, но с meleeSubtype «Кулак.Б». */
function armoredFist() {
  const w = bareFist();
  w.system.meleeSubtype = "Кулак.Б";
  return w;
}

// DAMAGE_TYPES (module/constants/items.mjs): R Dmg книги = "rending", E Dmg = "energy".
/** Оружие атакующего, резолвится по attackerWeaponUuid. */
function attackerWeapon(overrides = {}) {
  return { type: "weapon", uuid: "Item.attacker-weapon", system: { damage: "1d10+3", damageType: "rending", weaponProps: [], ...overrides } };
}

function attackerActorObj(overrides = {}) {
  return { uuid: "Actor.attacker-1", name: "Атакующий", system: { characteristics: { s: char(40) }, ...overrides } };
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10]; // гарантированный успех Парирования порогом WS 45
  globalThis.game.combat = undefined;
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("Безоружное Парирование: −20 против полноценного оружия", () => {
  it("голый кулак против оружия — штраф −20 в разбивке порога", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon();
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    const actor = attacker({ items: [bareFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    expect(captured.chat.at(-1).content).toContain("безоружное Парирование -20");
  });

  it("вооружённый защитник (обычный меч) — штрафа нет", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon();
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    const sword = weaponFor({ weaponClass: "melee", balance: 0, equipped: true }, { id: "sword" });
    sword.type = "weapon";
    const actor = attacker({ items: [sword] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    expect(captured.chat.at(-1).content).not.toContain("безоружное Парирование");
  });

  it("голый кулак против БЕЗоружного атакующего — штрафа нет (не «полноценное оружие»)", async () => {
    const atkActor = attackerActorObj();
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : null);

    const actor = attacker({ items: [bareFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid }); // без attackerWeaponUuid

    expect(captured.chat.at(-1).content).not.toContain("безоружное Парирование");
  });
});

describe("Кулак.Б: исключение из −20 только против R/E(+Power Field)", () => {
  it("против R Dmg — штрафа нет, «полноценное оружие»", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon({ damageType: "rending" });
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    const actor = attacker({ items: [armoredFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    expect(captured.chat.at(-1).content).not.toContain("безоружное Парирование");
  });

  it("против I Dmg (булава) — штраф остаётся: исключение только для R/E", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon({ damageType: "impact" });
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    const actor = attacker({ items: [armoredFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    expect(captured.chat.at(-1).content).toContain("безоружное Парирование -20");
  });

  it("против E Dmg БЕЗ Power Field — штраф остаётся", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon({ damageType: "energy" });
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    const actor = attacker({ items: [armoredFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    expect(captured.chat.at(-1).content).toContain("безоружное Парирование -20");
  });

  it("против E Dmg С Power Field — штрафа нет", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon({ damageType: "energy", weaponProps: [{ key: "powerField" }] });
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    // Power Field атакующего запускает и «−20 exemption», и (независимо от
    // неё) бросок «уничтожает ли безоружную защиту» ниже — второй кубик 90
    // (76+, защита цела), не проверяется в этом тесте отдельно.
    captured.dice = [10, 90];
    const actor = attacker({ items: [armoredFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    expect(captured.chat.at(-1).content).not.toContain("безоружное Парирование");
  });
});

describe("Силовое поле против безоружной защиты (Кулак/Кулак.Б)", () => {
  it("уничтожает (1-75) — попадание оружием атакующего в Руку, S.b атакующего", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon({ damageType: "R", weaponProps: [{ key: "powerField" }] });
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    // 10 — успех Парирования; 5 — 1-75 (уничтожено); 6 — кубик урона атакующего.
    captured.dice = [10, 5, 6];
    const actor = attacker({ items: [armoredFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Силовое поле противника");
    expect(card).toContain("безоружная защита не выдержала");
    expect(card).toContain("Руку");
  });

  it("выдерживает (76+) — защита цела", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon({ damageType: "R", weaponProps: [{ key: "powerField" }] });
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    captured.dice = [10, 90]; // 10 — успех Парирования; 90 — 76+, защита цела.
    const actor = attacker({ items: [armoredFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("безоружная защита выдержала");
  });

  it("без Power Field у атакующего — блока про Силовое поле противника нет вовсе", async () => {
    const atkActor = attackerActorObj();
    const atkWeapon = attackerWeapon({ damageType: "rending" });
    globalThis.fromUuid = async uuid => (uuid === atkActor.uuid ? atkActor : uuid === atkWeapon.uuid ? atkWeapon : null);

    captured.dice = [10];
    const actor = attacker({ items: [armoredFist()] });
    await _performParry(actor, { extraMod: 0, attackerUuid: atkActor.uuid, attackerWeaponUuid: atkWeapon.uuid });

    expect(captured.chat.at(-1).content).not.toContain("Силовое поле противника");
  });
});
