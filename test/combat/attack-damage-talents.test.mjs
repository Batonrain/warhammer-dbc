// test/combat/attack-damage-talents.test.mjs
//
// Таланты боевых бонусов главы 3 (Sahara 3-8dc5 / 3-5fbf / 3-9d40), та часть,
// что живёт в combat/attack.mjs: Крушащий Удар, Могучий Выстрел, Эксперт
// Плазмы, Мастерство Плазмы. Логика — rules/damage-talents.mjs.
//
// Каждый Талант проверяется двумя путями опознания: по ключу Возможности (у
// предмета испорчено имя) и по имени (у персонажа Талант куплен до того, как в
// паке у него появилась запись Конструктора — предметы на акторах снимки).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const damages = () => [...card().matchAll(/data-damage="(\d+)"/g)].map(m => Number(m[1]));
const penetration = () => Number(card().match(/data-penetration="(-?\d+)"/)?.[1]);

/** Талант с записью Конструктора; имя нарочно чужое — совпасть может только ключ. */
const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
/** Талант без записи Конструктора — как у персонажа, купившего его раньше. */
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

const CRUSHING = { key: "meleeCore.core.crushingBlow", name: "Crushing Blow / Крушащий Удар" };
const MIGHTY   = { key: "rangedCore.core.mightyShot", name: "Mighty Shot / Могучий Выстрел" };
const EXPERTISE = { key: "weaponsmith.core.plasmaExpertise", name: "Plasma Expertise / Эксперт Плазмы" };
const MASTERY   = { key: "weaponsmith.core.plasmaMastery", name: "Plasma Mastery / Мастерство Плазмы" };

// S.b 0, чтобы в рукопашной слагаемое Силы не мешало арифметике Таланта.
const fighter = (items, { ws = 45, bs = 45 } = {}) =>
  actorFor({ items, characteristics: { ws: char(ws), bs: char(bs), s: char(9), t: char(40), ag: char(35) } });

const sword = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

// ── Crushing Blow ───────────────────────────────────────────────────────────

describe("Крушащий Удар: +½WS.b (окр.▲) к рукопашному урону", () => {
  async function swing(items, { ws = 45, weapon = sword() } = {}) {
    const actor = fighter([weapon, ...items], { ws });
    captured.dice = [20, 5]; // порог 45, бросок 20 — попадание; урон d10 = 5
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});
  }

  it("без Таланта урон — голый кубик", async () => {
    await swing([]);
    expect(damages()).toEqual([5]);
  });

  it("по ключу Возможности: WS.b 4 → +2", async () => {
    await swing([talentByKey(CRUSHING.key)]);
    expect(damages()).toEqual([7]);
  });

  it("по имени (Талант без записи Конструктора): тот же +2", async () => {
    await swing([talentByName(CRUSHING.name)]);
    expect(damages()).toEqual([7]);
  });

  it("округление вверх: WS.b 5 → ½ = 2,5 → +3", async () => {
    await swing([talentByKey(CRUSHING.key)], { ws: 55 });
    expect(damages()).toEqual([8]);
  });

  it("стрелковое оружие бонус не получает", async () => {
    const gun = weaponFor({ damage: "1d10", penetration: 0 });
    const actor = fighter([gun, talentByKey(CRUSHING.key)]);
    captured.dice = [20, 5];
    await _executeAttackRoll(actor, gun, "bs", 45, "single", null, {});
    expect(damages()).toEqual([5]);
  });

  it("в карточке названа причина прибавки", async () => {
    await swing([talentByKey(CRUSHING.key)]);
    expect(card()).toContain("Крушащий Удар");
  });
});

// ── Mighty Shot ─────────────────────────────────────────────────────────────

describe("Могучий Выстрел: +½BS.b (окр.▲) к стрелковому урону, кроме урона по площади", () => {
  const gun = (props = []) => weaponFor({ damage: "1d10", penetration: 0, weaponProps: props });
  async function shoot(items, weapon, { bs = 55, rof = "single" } = {}) {
    const actor = fighter([weapon, ...items], { bs });
    captured.dice = [23, 6]; // бросок 23 при пороге 45 — попадание; урон d10 = 6
    await _executeAttackRoll(actor, weapon, "bs", 45, rof, null, {});
  }

  it("без Таланта урон — голый кубик", async () => {
    await shoot([], gun());
    expect(damages()).toEqual([6]);
  });

  it("по ключу Возможности: BS.b 5 → ½ = 2,5 → +3", async () => {
    await shoot([talentByKey(MIGHTY.key)], gun());
    expect(damages()).toEqual([9]);
  });

  it("по имени (Талант без записи Конструктора): тот же +3", async () => {
    await shoot([talentByName(MIGHTY.name)], gun());
    expect(damages()).toEqual([9]);
  });

  it("рукопашное оружие бонус не получает", async () => {
    const weapon = sword();
    const actor = fighter([weapon, talentByKey(MIGHTY.key)]);
    captured.dice = [20, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});
    expect(damages()).toEqual([5]);
  });

  it("Распыление — урон по площади, бонуса нет и напоминания нет", async () => {
    const weapon = gun([{ key: "spray", rating: 0, rating2: 0 }]);
    const actor = fighter([weapon, talentByKey(MIGHTY.key)], { bs: 55 });
    captured.dice = [23, 6];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(damages()).toEqual([6]);
    expect(card()).not.toContain("Могучий Выстрел");
  });

  it("Взрывное — в число урона бонус не входит (число уходит всем в шаблоне), но карточка напоминает прибавить центру", async () => {
    await shoot([talentByKey(MIGHTY.key)], gun([{ key: "blast", rating: 2, rating2: 0 }]));
    expect(damages()).toEqual([6]);
    expect(card()).toContain("Могучий Выстрел");
    expect(card()).toContain("+3");
  });
});

// ── Plasma Expertise ────────────────────────────────────────────────────────

describe("Эксперт Плазмы: +1 Надёжность плазме со свойством Перегрев", () => {
  const plasma = (props, type = "plasma") => weaponFor({ weaponType: type, damage: "1d10", weaponProps: props });
  const OVERHEATS = [{ key: "overheats", rating: 0, rating2: 0 }];
  // Надёжность 0 клинит с 96+, у Перегрева −1 — с 91+, с Талантом снова с 96+.
  async function fire(items, weapon, rv) {
    const actor = fighter([weapon, ...items]);
    captured.dice = [rv];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    return weapon.system.jammed;
  }

  it("без Таланта Перегрев клинит с 91", async () => {
    expect(await fire([], plasma(OVERHEATS), 93)).toBe(true);
  });

  it("с Талантом (по ключу) Перегрев не клинит на 93, клинит на 96", async () => {
    expect(await fire([talentByKey(EXPERTISE.key)], plasma(OVERHEATS), 93)).toBeFalsy();
    resetCaptured();
    expect(await fire([talentByKey(EXPERTISE.key)], plasma(OVERHEATS), 96)).toBe(true);
  });

  it("с Талантом (по имени) — то же", async () => {
    expect(await fire([talentByName(EXPERTISE.name)], plasma(OVERHEATS), 93)).toBeFalsy();
  });

  it("не плазма (лазер с Перегревом) — Талант не действует", async () => {
    expect(await fire([talentByKey(EXPERTISE.key)], plasma(OVERHEATS, "laser"), 93)).toBe(true);
  });

  it("плазма без Перегрева — надёжность не растёт (клинит с 96 как у обычного)", async () => {
    expect(await fire([talentByKey(EXPERTISE.key)], plasma([]), 96)).toBe(true);
  });
});

// ── Plasma Mastery ──────────────────────────────────────────────────────────

describe("Мастерство Плазмы: в режиме Maximal ещё +2 Dmg и +2 Pen", () => {
  const MAXIMAL = [{ key: "maximal", rating: 0, rating2: 0 }];
  const plasma = (type = "plasma") => weaponFor({ weaponType: type, damage: "1d10", penetration: 4, weaponProps: MAXIMAL });
  async function fire(items, weapon, maximal) {
    const actor = fighter([weapon, ...items]);
    captured.dice = [23, 5, 4]; // атака, d10 урона, +1d10 Максимального режима
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { maximal });
  }

  it("без Таланта: Maximal даёт только свои +1d10 и +2 Pen", async () => {
    await fire([], plasma(), true);
    expect(damages()).toEqual([9]);
    expect(penetration()).toBe(6);
  });

  it("с Талантом (по ключу): +2 к урону и +2 к Pen поверх Maximal", async () => {
    await fire([talentByKey(MASTERY.key)], plasma(), true);
    expect(damages()).toEqual([11]);
    expect(penetration()).toBe(8);
    expect(card()).toContain("Мастерство Плазмы");
  });

  it("с Талантом (по имени) — то же", async () => {
    await fire([talentByName(MASTERY.name)], plasma(), true);
    expect(damages()).toEqual([11]);
    expect(penetration()).toBe(8);
  });

  it("Maximal не включён — Талант молчит", async () => {
    captured.dice = [23, 5];
    const weapon = plasma();
    const actor = fighter([weapon, talentByKey(MASTERY.key)]);
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { maximal: false });
    expect(damages()).toEqual([5]);
    expect(penetration()).toBe(4);
    expect(card()).not.toContain("Мастерство Плазмы");
  });

  it("не плазма (болтер с Maximal) — Талант не действует", async () => {
    await fire([talentByKey(MASTERY.key)], plasma("bolt"), true);
    expect(damages()).toEqual([9]);
    expect(penetration()).toBe(6);
  });
});
