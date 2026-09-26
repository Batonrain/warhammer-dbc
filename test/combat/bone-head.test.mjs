// test/combat/bone-head.test.mjs
//
// BONE-Head / Костеголов (Огрин): «любой тест I занимает минимум полное
// действие»; при Сбое импланта (поле Haywire 3+) «все ментальные действия
// занимают вдвое больше времени»; Сбой держится, «пока не покинет поле».

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { mentalApCost, mentalSustainedThreshold, leftHaywireField, HAYWIRE_FIELD_FLAG } from "../../module/rules/bone-head.mjs";
import { canSpendActionPoints, spendActionPoints, effectiveApCost } from "../../module/combat/action-economy.mjs";
import { payIntTestAction, checkHaywireFieldExit } from "../../module/combat/bone-head.mjs";

const BONE = { type: "trait", name: "BONE-Head / Костеголов", system: {} };

function ogryn({ conditions = {}, ap = 2, items = [BONE] } = {}) {
  const store = {};
  const doc = {
    type: "character", name: "Огрин", items,
    system: { conditions, actionPoints: { value: ap, max: 2 }, reactions: { value: 1, max: 1 } }
  };
  doc.update = async (changes = {}) => {
    for (const [path, value] of Object.entries(changes)) {
      const m = path.match(/^flags\.([^.]+)\.(-=)?(.+)$/);
      if (m) { const [, s, del, k] = m; if (del) delete store[`${s}.${k}`]; else store[`${s}.${k}`] = value; continue; }
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  doc.getFlag = (s, k) => store[`${s}.${k}`];
  doc.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  doc.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  doc.effects = [];
  return doc;
}

const inOwnTurn = actor => { globalThis.game.combat = { started: true, combatant: { actor } }; };
afterEach(() => { globalThis.game.combat = undefined; });

describe("чистая арифметика", () => {
  it("ментальное при Сбое — вдвое, физическое и неуказанное — как есть", () => {
    expect(mentalApCost(1, { physical: false, disrupted: true })).toBe(2);
    expect(mentalApCost(1, { physical: true, disrupted: true })).toBe(1);
    expect(mentalApCost(1, { disrupted: true })).toBe(1);
    expect(mentalApCost(1, { physical: false, disrupted: false })).toBe(1);
    expect(mentalSustainedThreshold(3, { physical: false, disrupted: true })).toBe(6);
  });

  it("выход из поля — по радиусу в метрах; Haywire (0) не отпускает", () => {
    const field = { x: 0, y: 0, radius: 3 };
    const grid = { gridSize: 100, gridDistance: 1 };
    expect(leftHaywireField(field, { x: 300, y: 0 }, grid)).toBe(false);
    expect(leftHaywireField(field, { x: 301, y: 0 }, grid)).toBe(true);
    expect(leftHaywireField({ ...field, radius: 0 }, { x: 10_000, y: 0 }, grid)).toBe(false);
  });
});

describe("ментальные траты ОД при Сбое импланта", () => {
  it("Полудействие ментальное стоит 2 ОД", async () => {
    const a = ogryn({ conditions: { implantHaywire: true } });
    inOwnTurn(a);
    expect(effectiveApCost(a, 1, { physical: false })).toBe(2);
    expect(await spendActionPoints(a, 1, { physical: false })).toBe(true);
    expect(a.system.actionPoints.value).toBe(0);
  });

  it("Полное ментальное в Ход не влезает; Ход Длительного — как есть", () => {
    const a = ogryn({ conditions: { implantHaywire: true } });
    inOwnTurn(a);
    expect(canSpendActionPoints(a, 2, { physical: false })).toBe(false);
    expect(canSpendActionPoints(a, 2, { physical: false, sustained: true })).toBe(true);
  });

  it("без Сбоя или без Черты — обычная цена", () => {
    const calm = ogryn();
    const human = ogryn({ conditions: { implantHaywire: true }, items: [] });
    expect(effectiveApCost(calm, 1, { physical: false })).toBe(1);
    expect(effectiveApCost(human, 1, { physical: false })).toBe(1);
  });
});

describe("тест I — Полное действие", () => {
  it("в свой Ход в бою списывает 2 ОД", async () => {
    const a = ogryn();
    inOwnTurn(a);
    expect(await payIntTestAction(a, "int")).toBe(true);
    expect(a.system.actionPoints.value).toBe(0);
  });

  it("не хватает ОД — теста нет", async () => {
    const a = ogryn({ ap: 1 });
    inOwnTurn(a);
    expect(await payIntTestAction(a, "int")).toBe(false);
    expect(a.system.actionPoints.value).toBe(1);
  });

  it("не I, вне боя, не свой Ход или без Черты — бесплатно", async () => {
    const a = ogryn();
    inOwnTurn(a);
    expect(await payIntTestAction(a, "ag")).toBe(true);
    expect(a.system.actionPoints.value).toBe(2);
    globalThis.game.combat = { started: true, combatant: { actor: ogryn() } };
    expect(await payIntTestAction(a, "int")).toBe(true);
    globalThis.game.combat = undefined;
    expect(await payIntTestAction(a, "int")).toBe(true);
    const h = ogryn({ items: [] });
    inOwnTurn(h);
    expect(await payIntTestAction(h, "int")).toBe(true);
    expect(a.system.actionPoints.value).toBe(2);
    expect(h.system.actionPoints.value).toBe(2);
  });
});

describe("выход из поля снимает Сбой", () => {
  const tokenAt = (actor, x) => ({ actor, x, y: 0, width: 1, height: 1, parent: { id: "s1", grid: { size: 100, distance: 1 } } });

  it("вышел за радиус — Сбой и Ступор этого поля сняты, поле забыто", async () => {
    const a = ogryn({ conditions: { implantHaywire: true, dazed: true } });
    await a.setFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG, { sceneId: "s1", x: 50, y: 50, radius: 3, dazed: true });
    await checkHaywireFieldExit(tokenAt(a, 200));
    expect(a.system.conditions.implantHaywire).toBe(true);
    await checkHaywireFieldExit(tokenAt(a, 400));
    expect(a.system.conditions.implantHaywire).toBe(false);
    expect(a.system.conditions.dazed).toBe(false);
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBeUndefined();
  });

  it("чужой Ступор (не от поля) не трогается", async () => {
    const a = ogryn({ conditions: { implantHaywire: true, dazed: true } });
    await a.setFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG, { sceneId: "s1", x: 50, y: 50, radius: 3, dazed: false });
    await checkHaywireFieldExit(tokenAt(a, 400));
    expect(a.system.conditions.implantHaywire).toBe(false);
    expect(a.system.conditions.dazed).toBe(true);
  });
});
