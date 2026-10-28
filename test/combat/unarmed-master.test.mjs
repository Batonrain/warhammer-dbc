// test/combat/unarmed-master.test.mjs
//
// Unarmed Master / Безоружный Мастер (Пугилист, стр. 62; задача Sahara 3-eddb,
// решения владельца 24.10.2026): «Его безоружные атаки теряют свойство
// Primitive, он считается вооруженным при парировании других атак голыми
// руками, его Захват нельзя Парировать, а его оружие-кулаки с Балансом ниже 0
// получает +1 к Балансу.»
//
//   • Парирование голыми руками: нет −20 против полноценного оружия, действуют
//     правила «вооружён против безоружного» (+20, ответный удар за 2 Успеха).
//   • Баланс кулака ниже 0 → +1 (Парирование читает его же).
//   • fistBalanceBonus — единый помощник для Парирования, окна атаки и листа.
//   • unarmedLosesPrimitive / grappleUnparryable — чистые решения для attack.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry } from "../../module/combat/defense.mjs";
import { hasPugilistTalent, fistBalanceBonus, unarmedLosesPrimitive, grappleUnparryable }
  from "../../module/rules/pugilist-talents.mjs";

const DEFAULT_SOURCES = getRuleSources();

const MASTER = { id: "um", name: "Unarmed Master / Безоружный Мастер", type: "talent", system: {} };

function fighter(items = [], { uuid = "Actor.def", name = "Защитник" } = {}) {
  const a = actorFor({ skills: { parry: { rank: "expert" } }, items });
  a.uuid = uuid;
  a.name = name;
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.update = async () => {};
  a.items.contents = a.items;
  for (const i of items) { i.actor = a; i.parent = a; }
  return a;
}

function fist({ balance = -1, id = "fist", uuid = "Item.fist", category = "Кулаки" } = {}) {
  const w = weaponFor({ weaponClass: "melee", balance, equipped: true, damage: "1d5-3", damageType: "impact",
                        grips: "Кист", meleeCategory: category }, { id, name: "Кулак" });
  w.uuid = uuid;
  w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
  return w;
}

function sword() {
  const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, damage: "1d10", damageType: "rending",
                        penetration: 2, weaponProps: [] }, { id: "sword", name: "Меч" });
  w.uuid = "Item.sword";
  return w;
}

function resolver(...docs) {
  globalThis.fromUuid = async uuid => docs.find(d => d?.uuid === uuid) ?? null;
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10];
  globalThis.game.combat = undefined;
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("hasPugilistTalent: опознание по имени и по ключу Возможности", () => {
  it("по имени предмета-Таланта", () => {
    expect(hasPugilistTalent(actorFor({ items: [MASTER] }), "unarmedMaster")).toBe(true);
    expect(hasPugilistTalent(actorFor({}), "unarmedMaster")).toBe(false);
  });
  it("по записи Конструктора kind:capability", () => {
    const t = { id: "x", name: "Иное", type: "talent", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ entries: [{ kind: "capability", capabilityKey: "pugilist.core.unarmedMaster" }] }] } } };
    expect(hasPugilistTalent(actorFor({ items: [t] }), "unarmedMaster")).toBe(true);
  });
  it("неизвестный id — false", () => {
    expect(hasPugilistTalent(actorFor({ items: [MASTER] }), "nope")).toBe(false);
  });
});

describe("fistBalanceBonus: +1 к Балансу кулаков с Балансом ниже 0", () => {
  const master = actorFor({ items: [MASTER] });
  it("кулак −1 → +1", () => expect(fistBalanceBonus(master, fist({ balance: -1 }))).toBe(1));
  it("кулак −2 → +1 (на 1, не до нуля)", () => expect(fistBalanceBonus(master, fist({ balance: -2 }))).toBe(1));
  it("кулак 0 и выше — без прибавки", () => {
    expect(fistBalanceBonus(master, fist({ balance: 0 }))).toBe(0);
    expect(fistBalanceBonus(master, fist({ balance: 1 }))).toBe(0);
  });
  it("не кулак (Пинок/Меч с Балансом −1) — без прибавки", () => {
    expect(fistBalanceBonus(master, fist({ balance: -1, category: "Меч" }))).toBe(0);
  });
  it("щупальце (категория «Кулаки», хват «Щуп») кулаком не считается", () => {
    const tentacle = fist({ balance: -1 });
    tentacle.system.grips = "Щуп";
    expect(fistBalanceBonus(master, tentacle)).toBe(0);
  });
  it("без Таланта — без прибавки", () => {
    expect(fistBalanceBonus(actorFor({}), fist({ balance: -1 }))).toBe(0);
  });
});

describe("unarmedLosesPrimitive / grappleUnparryable", () => {
  it("безоружная (интегральная) атака мастера теряет Primitive; обычное оружие — нет", () => {
    const master = actorFor({ items: [MASTER] });
    expect(unarmedLosesPrimitive(master, fist())).toBe(true);
    expect(unarmedLosesPrimitive(master, sword())).toBe(false);
    expect(unarmedLosesPrimitive(actorFor({}), fist())).toBe(false);
  });
  it("Захват мастера не Парируется; чужой — Парируется", () => {
    expect(grappleUnparryable(actorFor({ items: [MASTER] }), "grapple")).toBe(true);
    expect(grappleUnparryable(actorFor({ items: [MASTER] }), "feint")).toBe(false);
    expect(grappleUnparryable(actorFor({}), "grapple")).toBe(false);
  });
});

describe("_performParry: голые руки мастера считаются вооружёнными", () => {
  it("без Таланта: кулак против меча — штраф −20 (регрессия)", async () => {
    const enemy = sword(); enemy.uuid = "Item.enemy-sword";
    const atk = fighter([enemy], { uuid: "Actor.atk" });
    resolver(atk, enemy);
    await _performParry(fighter([fist()]), { attackerUuid: atk.uuid, attackerWeaponUuid: enemy.uuid });
    expect(captured.chat.at(-1).content).toContain("безоружное Парирование -20");
  });

  it("мастер: кулак против меча — без −20", async () => {
    const enemy = sword(); enemy.uuid = "Item.enemy-sword";
    const atk = fighter([enemy], { uuid: "Actor.atk" });
    resolver(atk, enemy);
    await _performParry(fighter([fist(), MASTER]), { attackerUuid: atk.uuid, attackerWeaponUuid: enemy.uuid });
    expect(captured.chat.at(-1).content).not.toContain("безоружное Парирование");
  });

  it("мастер: кулак против кулака — «вооружён против безоружной атаки +20» и кнопка Ответного удара", async () => {
    const theirs = fist({ id: "their-fist", uuid: "Item.their-fist" });
    const atk = fighter([theirs], { uuid: "Actor.atk" });
    resolver(atk, theirs);
    await _performParry(fighter([fist(), MASTER]), { attackerUuid: atk.uuid, attackerWeaponUuid: theirs.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("вооружён против безоружной атаки +20");
    expect(card).toContain("wh-unarmed-riposte-btn");
  });

  it("без Таланта: кулак против кулака — бонуса +20 и кнопки нет (регрессия)", async () => {
    const theirs = fist({ id: "their-fist", uuid: "Item.their-fist" });
    const atk = fighter([theirs], { uuid: "Actor.atk" });
    resolver(atk, theirs);
    await _performParry(fighter([fist()]), { attackerUuid: atk.uuid, attackerWeaponUuid: theirs.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("вооружён против безоружной атаки");
    expect(card).not.toContain("wh-unarmed-riposte-btn");
  });

  it("мастер: Баланс кулака −1 → 0 — штрафа «баланс −10» нет; без Таланта он есть", async () => {
    const enemy = sword(); enemy.uuid = "Item.enemy-sword";
    const atk = fighter([enemy], { uuid: "Actor.atk" });
    resolver(atk, enemy);
    await _performParry(fighter([fist(), MASTER]), { attackerUuid: atk.uuid, attackerWeaponUuid: enemy.uuid });
    expect(captured.chat.at(-1).content).not.toMatch(/баланс -10/);
    resetCaptured(); captured.dice = [10];
    await _performParry(fighter([fist()]), { attackerUuid: atk.uuid, attackerWeaponUuid: enemy.uuid });
    expect(captured.chat.at(-1).content).toMatch(/баланс -10/);
  });
});

// ── Сквозные проверки через настоящий _executeAttackRoll ─────────────────────
import { setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { addEvasionSurplus } from "../../module/combat/evasion-pool.mjs";

describe("_executeAttackRoll: Безоружный Мастер", () => {
  function integralFist(extraSys = {}) {
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки", balance: -1, grips: "Кист", damage: "1d5-3",
                          weaponProps: [{ key: "primitive" }], ...extraSys }, { id: "fist", name: "Кулак" });
    w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
    return w;
  }
  const card = () => captured.chat.at(-1)?.content ?? "";
  const allCards = () => captured.chat.map(m => m.content).join("\n");

  it("без Таланта безоружная атака Primitive (регрессия)", async () => {
    const w = integralFist();
    const a = actorFor({ items: [w] });
    setTargets([]);
    captured.dice = [10, 3, 3, 3, 3];
    await _executeAttackRoll(a, w, "ws", 45, "melee", null, {});
    expect(card()).toContain('data-primitive="1"');
  });

  it("мастер: безоружная атака теряет Primitive", async () => {
    const w = integralFist();
    const a = actorFor({ items: [w, MASTER] });
    setTargets([]);
    captured.dice = [10, 3, 3, 3, 3];
    await _executeAttackRoll(a, w, "ws", 45, "melee", null, {});
    expect(card()).toContain('data-primitive="0"');
  });

  it("мастер: обычное оружие (не интегральное) Primitive не теряет", async () => {
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Булава", balance: 0, weaponProps: [{ key: "primitive" }] },
                        { id: "club", name: "Дубина" });
    const a = actorFor({ items: [w, MASTER] });
    setTargets([]);
    captured.dice = [10, 3, 3, 3, 3];
    await _executeAttackRoll(a, w, "ws", 45, "melee", null, {});
    expect(card()).toContain('data-primitive="1"');
  });

  async function grappleBy(attackerItems) {
    const w = integralFist();
    const attacker = actorFor({ items: [w, ...attackerItems] });
    attacker.uuid = "Actor.attacker";
    const target = actorFor({});
    target.uuid = "Actor.target";
    target.getFlag = function (scope, key) { return this._flags?.[key]; };
    target.setFlag = async function (scope, key, value) { (this._flags ??= {})[key] = value; };
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
    await addEvasionSurplus(target, attacker.uuid, 5, 0);
    setTargets([target]);
    captured.dice = [10, 3, 3, 3, 3];
    await _executeAttackRoll(attacker, w, "ws", 45, "melee", null,
      { techniqueOpts: { technique: "grapple", targetDodgeMod: 0, targetParryMod: -30 } });
  }

  it("Захват мастера: Парирование недоступно (порог −999), кнопки отказа от Парирования за банк нет", async () => {
    await grappleBy([MASTER]);
    expect(allCards()).toContain("Парирование (невозможно)");
    expect(allCards()).not.toContain("wh-pool-grapple-parry-btn");
  });

  it("Захват без Таланта: Парирование −30 и кнопка банка (регрессия)", async () => {
    await grappleBy([]);
    expect(allCards()).toContain("Парирование (-30)");
    expect(allCards()).not.toContain("Парирование (невозможно)");
    expect(allCards()).toContain("wh-pool-grapple-parry-btn");
  });
});
