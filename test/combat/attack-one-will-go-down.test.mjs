// test/combat/attack-one-will-go-down.test.mjs
//
// Один Из Нас Падёт / One Will Go Down (Берсерк, Sahara 3-861e). Книга (core.json, pdf-стр. 78):
// Полная Атака по Ненавистной цели — Dmg ×2 (до Поглощения); убил/вывел из строя — 1 Усталости,
// нет (в т.ч. промах) — T.b+W.b Усталости (и потеря сознания); при любом исходе 1d5 непоглощаемого
// R Dmg в руку. Условие — rules/berserker-talents.mjs, бросок — combat/attack.mjs,
// итог Усталости — combat/one-will-go-down.mjs, галочка — sheets/attack/talent-toggles.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { talentTogglesHtml } from "../../module/sheets/attack/talent-toggles.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";
import { settleOneWillGoDown } from "../../module/combat/one-will-go-down.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const dmg1 = () => Number(card().match(/Применить урон 1: <b>(\d+)<\/b>/)?.[1]);

const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const OWGD = { key: "berserker.core.oneWillGoDown", name: "One Will Go Down / Один Из Нас Падёт" };
const hatred = () => ({ id: "hatred", name: "Hatred / Ненависть", type: "talent",
  system: { targets: [raceTarget("ork", "Орк")] }, flags: {}, getFlag: () => undefined });
const ork = { id: "ork", name: "Орк", system: { race: "ork" }, items: [], getFlag: () => undefined };
const human = { id: "man", name: "Человек", system: { race: "human" }, items: [], getFlag: () => undefined };

function who(items) {
  const a = actorFor({ items, fate: { value: 3, max: 5 }, wounds: { value: 20, max: 20, critical: 0 },
    fatigue: { value: 0 },
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), wp: char(30), ag: char(35), inf: char(40) } });
  a.updates = [];
  a.update = async data => { a.updates.push(data); for (const [p, v] of Object.entries(data)) { const k = p.split("."); let c = a; for (const x of k.slice(0, -1)) c = c[x] ??= {}; c[k.at(-1)] = v; } };
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  return a;
}

const realGetProperty = (o, p) => String(p).split(".").reduce((c, k) => c?.[k], o);
let stubGetProperty;
beforeEach(() => {
  resetCaptured(); setTargets([]);
  stubGetProperty = globalThis.foundry.utils.getProperty;
  globalThis.foundry.utils.getProperty = realGetProperty;
});
afterEach(() => { globalThis.foundry.utils.getProperty = stubGetProperty; });

const blade = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });

async function swing(items, { toggles = { oneWillGoDown: true }, baseKey = "fullatk", roll = 20, target = ork, extra = {} } = {}) {
  const w = blade();
  const actor = who([w, ...items]);
  setTargets(target ? [target] : []);
  captured.dice = [roll, 5, 5, 5, 3];
  await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey, talentToggles: toggles, ...extra });
  return actor;
}

describe("Один Из Нас Падёт: Dmg ×2 на Полной Атаке по Ненавистной цели", () => {
  it("без Таланта урон обычный; с Талантом — вдвое", async () => {
    await swing([hatred()], { toggles: {} });
    const plain = dmg1();
    expect(plain).toBeGreaterThan(0);
    await swing([hatred(), byKey(OWGD.key)]);
    expect(dmg1()).toBe(plain * 2);
    expect(card()).toContain("Один Из Нас Падёт");
  });

  it("по имени Таланта (снимок без записи Конструктора) — то же", async () => {
    await swing([hatred()], { toggles: {} });
    const plain = dmg1();
    await swing([hatred(), byName(OWGD.name)]);
    expect(dmg1()).toBe(plain * 2);
  });

  it("не срабатывает: без галочки, не Полная Атака, цель не Ненавистная, цели нет", async () => {
    await swing([hatred()], { toggles: {} });
    const plain = dmg1();
    const t = { toggles: { oneWillGoDown: true } };
    await swing([hatred(), byKey(OWGD.key)], { toggles: {} });
    expect(dmg1()).toBe(plain);
    await swing([hatred(), byKey(OWGD.key)], { ...t, baseKey: "standard" });
    expect(dmg1()).toBe(plain);
    await swing([hatred(), byKey(OWGD.key)], { ...t, target: human });
    expect(dmg1()).toBe(plain);
    await swing([hatred(), byKey(OWGD.key)], { ...t, target: null });
    expect(dmg1()).toBe(plain);
  });

  it("не складывается с Беспомощной целью в ×4: удвоение одно", async () => {
    await swing([hatred()], { toggles: {}, extra: { doubleDamage: true } });
    const helpless = dmg1();
    await swing([hatred(), byKey(OWGD.key)], { extra: { doubleDamage: true } });
    expect(dmg1()).toBe(helpless);
  });
});

describe("Один Из Нас Падёт: 1d5 непоглощаемого урона в руку при любом исходе", () => {
  it("попадание: Раны носителя уменьшились на 1..5, в карточке названа причина", async () => {
    const a = await swing([hatred(), byKey(OWGD.key)]);
    const lost = 20 - a.system.wounds.value;
    expect(lost).toBeGreaterThanOrEqual(1);
    expect(lost).toBeLessThanOrEqual(5);
    expect(card()).toContain("в руку");
  });

  it("промах: урон в руку всё равно идёт", async () => {
    const a = await swing([hatred(), byKey(OWGD.key)], { roll: 90 });
    expect(20 - a.system.wounds.value).toBeGreaterThanOrEqual(1);
  });

  it("не сработало условие (не Ненавистная цель) — рука цела", async () => {
    const a = await swing([hatred(), byKey(OWGD.key)], { target: human });
    expect(a.system.wounds.value).toBe(20);
  });

  it("переброс оплаченной атаки (talentPaid) руку второй раз не ранит, но ×2 остаётся", async () => {
    await swing([hatred()], { toggles: {} });
    const plain = dmg1();
    const a = await swing([hatred(), byKey(OWGD.key)], { toggles: {}, extra: { skipAmmo: true, talentPaid: { oneWillGoDown: true } } });
    expect(a.system.wounds.value).toBe(20);
    expect(dmg1()).toBe(plain * 2);
  });
});

describe("Один Из Нас Падёт: переброс без выделенной цели", () => {
  it("×2 остаётся, оплата помнится, рука не ранится заново", async () => {
    await swing([hatred()], { toggles: {} });
    const plain = dmg1();
    const a = await swing([hatred(), byKey(OWGD.key)], { toggles: {}, target: null, extra: { skipAmmo: true, talentPaid: { oneWillGoDown: true } } });
    expect(dmg1()).toBe(plain * 2);
    expect(a.system.wounds.value).toBe(20);
    expect(card()).toContain("wh-owgd-btn");
  });
});

describe("Один Из Нас Падёт: кнопка итога на карточке атаки", () => {
  it("есть, когда Талант сработал (и при попадании, и при промахе); нет без него", async () => {
    await swing([hatred(), byKey(OWGD.key)]);
    expect(card()).toContain("wh-owgd-btn");
    await swing([hatred(), byKey(OWGD.key)], { roll: 90 });
    expect(card()).toContain("wh-owgd-btn");
    await swing([hatred(), byKey(OWGD.key)], { toggles: {} });
    expect(card()).not.toContain("wh-owgd-btn");
  });
});

describe("Один Из Нас Падёт: итог — Усталость", () => {
  const fresh = () => who([]);
  const quiet = { post: async () => {} };

  it("вывел из строя — 1 Усталости", async () => {
    const a = fresh();
    const res = await settleOneWillGoDown(a, { felled: true, ...quiet });
    expect(res.fatigue).toBe(1);
    expect(a.system.fatigue.value).toBe(1);
  });

  it("не вывел (промах/Избегание) — T.b+W.b: 4+3 = 7, порог обморока достигнут", async () => {
    const a = fresh();
    const res = await settleOneWillGoDown(a, { felled: false, ...quiet });
    expect(res.fatigue).toBe(7);
    expect(a.system.fatigue.value).toBe(7);
    expect(a.system.conditions?.unconscious).toBeTruthy();
  });
});

describe("Один Из Нас Падёт: потеря сознания не зависит от обычного порога", () => {
  it("Ментальная Стойкость (порог T.b+2·W.b = 10): после неудачи Усталость 7, но Без сознания наложено явно", async () => {
    const a = who([byName("Mental Fortitude / Ментальная Стойкость")]);
    const res = await settleOneWillGoDown(a, { felled: false, post: async () => {} });
    expect(res.fatigue).toBe(7);
    expect(a.system.fatigue.value).toBe(7);
    expect(a.system.conditions?.unconscious).toBeTruthy();
    expect(a.system.conditions?.fatigueFaintWakeAt).toBeGreaterThan(0);
  });

  it("вывел из строя — сознание не трогается", async () => {
    const a = who([byName("Mental Fortitude / Ментальная Стойкость")]);
    await settleOneWillGoDown(a, { felled: true, post: async () => {} });
    expect(a.system.conditions?.unconscious).toBeFalsy();
  });
});

describe("Один Из Нас Падёт: галочка окна", () => {
  it("есть у носителя Таланта в рукопашной; нет без Таланта и в стрельбе", () => {
    expect(talentTogglesHtml(who([byKey(OWGD.key)]), blade(), { isMelee: true })).toContain('data-key="oneWillGoDown"');
    expect(talentTogglesHtml(who([]), blade(), { isMelee: true })).toBe("");
    expect(talentTogglesHtml(who([byKey(OWGD.key)]), blade(), { isMelee: false })).not.toContain("oneWillGoDown");
  });
});
