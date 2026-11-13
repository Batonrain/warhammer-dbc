// test/combat/attack-khorne-berserker.test.mjs
//
// Таланты Берсерка Кхорна (Sahara 1-54b9), та часть, что живёт в combat/attack.mjs:
// Подношение Черепов (+2 Dmg рукопашной), Кровавое Подношение (+½Cor.b Dmg, Освящённое, метка снимается
// попаданием), Окрась Всё в Красный (Экстремальный Урон от 8 на любом кубике). Логика — rules/khorne-berserker.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll, rollExtremeDamage } from "../../module/combat/attack.mjs";

const NS = "warhammer-dbc";
const card = () => captured.chat.at(-1)?.content ?? "";
const damageOf = () => Number(card().match(/data-damage="(\d+)"/)?.[1]);

const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const SKULL = "Skull Offering / Подношение Черепов";
const BLOOD = "Blood Offering / Кровавое Подношение";

const axe = () => {
  const w = weaponFor({
    weaponClass: "melee", meleeCategory: "Топор", grips: "П", damage: "1d10", damageType: "rending", penetration: 1
  });
  w.uuid = "Actor.actor-1.Item.weapon-1";
  return w;
};

function fighter(items, flags = {}) {
  const store = { ...flags };
  const actor = actorFor({
    items, corruptionBonus: 4, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) }
  });
  actor.getFlag = (scope, key) => (scope === NS ? store[key] : undefined);
  actor.setFlag = async (scope, key, value) => { store[key] = value; };
  actor.unsetFlag = async (scope, key) => { delete store[key]; };
  actor.store = store;
  return actor;
}

async function swing(items, { flags = {}, weapon = axe(), game = { id: "c1" } } = {}) {
  globalThis.game.combat = game ? { id: game.id, started: true, round: 1 } : undefined;
  globalThis.game.combats = globalThis.game.combat ? [globalThis.game.combat] : [];
  const actor = fighter([weapon, ...items], flags);
  captured.dice = [20, 5, 5, 5];
  await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey: "standard" });
  return actor;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Подношение Черепов: +2 Dmg рукопашной до конца боя", () => {
  it("с меткой этого боя урон выше ровно на 2, в карточке названа причина", async () => {
    await swing([]);
    const plain = damageOf();
    resetCaptured();
    await swing([talentByName(SKULL)], { flags: { skullOffering: { combatId: "c1" } } });
    expect(damageOf()).toBe(plain + 2);
    expect(card()).toContain("Подношение Черепов");
  });

  it("метка другого боя, нет Таланта или нет метки — бонуса нет", async () => {
    await swing([]);
    const plain = damageOf();
    for (const [items, flags] of [
      [[talentByName(SKULL)], { skullOffering: { combatId: "other" } }],
      [[], { skullOffering: { combatId: "c1" } }],
      [[talentByName(SKULL)], {}]
    ]) {
      resetCaptured();
      await swing(items, { flags });
      expect(damageOf()).toBe(plain);
    }
  });
});

describe("Кровавое Подношение: следующее попадание — +½Cor.b Dmg и Освящённое", () => {
  const mark = (w, over = {}) => ({ bloodOffering: { weaponUuid: w.uuid, turnsLeft: 3, combatId: "c1", ...over } });

  it("урон +2 (Cor.b 4), свойство Освящённое в карточке, метка снята попаданием", async () => {
    await swing([]);
    const plain = damageOf();
    resetCaptured();
    const w = axe();
    const actor = await swing([talentByName(BLOOD)], { weapon: w, flags: mark(w) });
    expect(damageOf()).toBe(plain + 2);
    expect(card()).toContain("Освящённое");
    expect(card()).toContain("Кровавое Подношение");
    expect(actor.store.bloodOffering).toBeUndefined();
  });

  it("метка на другое оружие или из другого боя — бонуса нет, метка цела", async () => {
    await swing([]);
    const plain = damageOf();
    resetCaptured();
    const w = axe();
    const other = await swing([talentByName(BLOOD)], { weapon: w, flags: mark(w, { weaponUuid: "Actor.x.Item.other" }) });
    expect(damageOf()).toBe(plain);
    expect(card()).not.toContain("Освящённое");
    expect(other.store.bloodOffering).toBeTruthy();
    resetCaptured();
    const w2 = axe();
    await swing([talentByName(BLOOD)], { weapon: w2, flags: mark(w2, { combatId: "c0" }) });
    expect(damageOf()).toBe(plain);
  });

  it("промах метку не тратит", async () => {
    const w = axe();
    globalThis.game.combat = { id: "c1", started: true, round: 1 };
    globalThis.game.combats = [globalThis.game.combat];
    const actor = fighter([w, talentByName(BLOOD)], mark(w));
    captured.dice = [99, 5, 5];
    await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey: "standard" });
    expect(actor.store.bloodOffering).toBeTruthy();
  });
});

describe("Окрась Всё в Красный: Экстремальный Урон от 8 на любом кубике", () => {
  const dmgRoll = results => ({ terms: [{ faces: 10, results: results.map(([result, active]) => ({ result, active })) }] });
  const opts = { damageType: "rending", hitLocation: "Торс" };

  it("8 на отброшенном кубике — Экстремальный Урон (порог без Таланта — 10)", async () => {
    const on = await rollExtremeDamage(dmgRoll([[3, true], [8, false]]), { wp: { extremeThreshold: 10, paintItRed: true }, ...opts });
    expect(on.hasExtreme).toBe(true);
    const off = await rollExtremeDamage(dmgRoll([[3, true], [8, false]]), { wp: { extremeThreshold: 10 }, ...opts });
    expect(off.hasExtreme).toBe(false);
  });

  it("10 остаётся Экстремальным и без 8; 7 и 9 — нет", async () => {
    expect((await rollExtremeDamage(dmgRoll([[10, true]]), { wp: { extremeThreshold: 10, paintItRed: true }, ...opts })).hasExtreme).toBe(true);
    expect((await rollExtremeDamage(dmgRoll([[7, true], [9, true]]), { wp: { extremeThreshold: 10, paintItRed: true }, ...opts })).hasExtreme).toBe(false);
  });

  it("в атаке: рукопашное R-оружие носителя получает признак, чужое оружие — нет", async () => {
    resetCaptured();
    const w = axe();
    const actor = fighter([w, talentByName("Paint It Red / Окрась Всё в Красный")]);
    captured.dice = [20, 8, 5];
    await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey: "standard" });
    expect(card()).toContain("Окрась Всё в Красный");
    expect(card()).toContain("Кровотечение");
    resetCaptured();
    const impact = weaponFor({ weaponClass: "melee", meleeCategory: "Топор", grips: "П", damage: "1d10", damageType: "impact", penetration: 1 });
    const plain = fighter([impact, talentByName("Paint It Red / Окрась Всё в Красный")]);
    captured.dice = [20, 8, 5];
    await _executeAttackRoll(plain, impact, "ws", 45, "melee", null, { baseKey: "standard" });
    expect(card()).not.toContain("Окрась Всё в Красный");
  });
});
