// test/combat/bone-head-actions.test.mjs
//
// BONE-Head / Костеголов (Огрин), вторая половина Черты — время и поле:
//  • «любой тест I занимает минимум полное действие» — 2 ОД до броска в свой
//    Ход в бою (combat/bone-head.mjs::payIntTestAction);
//  • сбитый имплант (поле Haywire 3+): «все ментальные действия занимают
//    вдвое больше времени» — трата ОД physical:false вдвое, Длительное
//    ментальное — вдвое больше Ходов;
//  • «…или пока не покинет поле» — попадание Haywire (X>0) запоминает
//    область, выход токена за радиус снимает поле и наложенный им Ступор;
//    Haywire (0) привязан к цели.
// Попадание, затухание и аура Дискорданта — test/combat/bone-head.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  mentalApCost, mentalSustainedThreshold, leftHaywireField, implantDisrupted,
  HAYWIRE_FIELD_FLAG, HAYWIRE_AREA_FLAG
} from "../../module/rules/bone-head.mjs";
import { canSpendActionPoints, spendActionPoints, effectiveApCost, apSpendGate } from "../../module/combat/action-economy.mjs";
import { beginSustainedAction } from "../../module/combat/sustained-action.mjs";
import { payIntTestAction, checkHaywireFieldExit, applyHaywireToBoneHead } from "../../module/combat/bone-head.mjs";

const NS = "warhammer-dbc";
const BONE = { type: "trait", name: "BONE-Head / Костеголов", system: {} };
const DISCORDANT = { type: "trait", name: "In the Discordant's Field / В Поле Дискорданта", system: {} };

function ogryn({ field = 0, ap = 2, items = [BONE], conditions = {}, token = null } = {}) {
  const flags = field ? { [HAYWIRE_FIELD_FLAG]: field } : {};
  const doc = {
    type: "character", name: "Огрин", items, effects: [],
    flags: { [NS]: flags },
    system: { conditions, characteristics: {}, actionPoints: { value: ap, max: 2 }, reactions: { value: 1, max: 1 } }
  };
  doc.token = token;
  doc.getFlag = (_s, k) => {
    // Вложенный путь sustainedActions.<key>
    return k.split(".").reduce((n, p) => n?.[p], flags);
  };
  doc.setFlag = async (_s, k, v) => {
    const parts = k.split(".");
    let n = flags;
    for (const p of parts.slice(0, -1)) n = (n[p] ??= {});
    n[parts.at(-1)] = v;
  };
  doc.unsetFlag = async (_s, k) => { delete flags[k]; };
  doc.createEmbeddedDocuments = async (_t, docs) => {
    for (const d of docs) d.delete = async () => { doc.effects.splice(doc.effects.indexOf(d), 1); };
    doc.effects.push(...docs);
    return docs;
  };
  doc.update = async (changes = {}) => {
    for (const [path, value] of Object.entries(changes)) {
      const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
      if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = value; continue; }
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  return doc;
}

const inOwnTurn = actor => { globalThis.game.combat = { started: true, combatant: { actor } }; };
beforeEach(() => resetCaptured());
afterEach(() => { globalThis.game.combat = undefined; });

describe("чистая арифметика", () => {
  it("ментальное при сбое — вдвое; физическое и неуказанное — как есть", () => {
    expect(mentalApCost(1, { physical: false, disrupted: true })).toBe(2);
    expect(mentalApCost(1, { physical: true, disrupted: true })).toBe(1);
    expect(mentalApCost(1, { disrupted: true })).toBe(1);
    expect(mentalApCost(1, { physical: false, disrupted: false })).toBe(1);
    expect(mentalSustainedThreshold(3, { physical: false, disrupted: true })).toBe(6);
    expect(mentalSustainedThreshold(3, { physical: true, disrupted: true })).toBe(3);
  });

  it("имплант сбит: Черта и поле 3+ (попадание или аура Дискорданта)", () => {
    expect(implantDisrupted(ogryn({ field: 3 }))).toBe(true);
    expect(implantDisrupted(ogryn({ field: 2 }))).toBe(false);
    expect(implantDisrupted(ogryn({ items: [BONE, DISCORDANT] }))).toBe(true);
    expect(implantDisrupted(ogryn({ field: 9, items: [] }))).toBe(false);
  });

  it("выход из поля — по радиусу в метрах; Haywire (0) не отпускает", () => {
    const area = { x: 0, y: 0, radius: 3 };
    const grid = { gridSize: 100, gridDistance: 1 };
    expect(leftHaywireField(area, { x: 300, y: 0 }, grid)).toBe(false);
    expect(leftHaywireField(area, { x: 301, y: 0 }, grid)).toBe(true);
    expect(leftHaywireField(area, { x: 200, y: 0 }, { gridSize: 100, gridDistance: 2 })).toBe(true);
    expect(leftHaywireField({ ...area, radius: 0 }, { x: 10_000, y: 0 }, grid)).toBe(false);
  });
});

describe("тест I — Полное действие", () => {
  it("в свой Ход в бою списывает 2 ОД", async () => {
    const a = ogryn();
    inOwnTurn(a);
    expect(await payIntTestAction(a, "int")).toBe(true);
    expect(a.system.actionPoints.value).toBe(0);
  });

  it("не хватает ОД — теста нет, ОД не тронуты", async () => {
    const a = ogryn({ ap: 1 });
    inOwnTurn(a);
    expect(await payIntTestAction(a, "int")).toBe(false);
    expect(a.system.actionPoints.value).toBe(1);
  });

  it("имплант сбит: тест I — ментальное Полное, вдвое, в Ход не влезает", async () => {
    const a = ogryn({ field: 5 });
    inOwnTurn(a);
    expect(await payIntTestAction(a, "int")).toBe(false);
    expect(a.system.actionPoints.value).toBe(2);
  });

  it("не I, вне боя, не свой Ход или без Черты — бесплатно", async () => {
    const a = ogryn();
    inOwnTurn(a);
    expect(await payIntTestAction(a, "ag")).toBe(true);
    globalThis.game.combat = { started: true, combatant: { actor: ogryn() } };
    expect(await payIntTestAction(a, "int")).toBe(true);
    globalThis.game.combat = undefined;
    expect(await payIntTestAction(a, "int")).toBe(true);
    expect(a.system.actionPoints.value).toBe(2);
    const h = ogryn({ items: [] });
    inOwnTurn(h);
    expect(await payIntTestAction(h, "int")).toBe(true);
    expect(h.system.actionPoints.value).toBe(2);
  });
});

describe("ментальные действия вдвое при сбитом импланте", () => {
  it("ментальное Полудействие стоит 2 ОД", async () => {
    const a = ogryn({ field: 4 });
    inOwnTurn(a);
    expect(effectiveApCost(a, 1, { physical: false })).toBe(2);
    expect(await spendActionPoints(a, 1, { physical: false })).toBe(true);
    expect(a.system.actionPoints.value).toBe(0);
  });

  it("физическое и неуказанное — как есть", async () => {
    const a = ogryn({ field: 4 });
    inOwnTurn(a);
    expect(effectiveApCost(a, 1, { physical: true })).toBe(1);
    expect(effectiveApCost(a, 1, {})).toBe(1);
  });

  it("ментальное Полное в Ход не влезает; кнопка называет удвоение", () => {
    const a = ogryn({ field: 4 });
    inOwnTurn(a);
    expect(canSpendActionPoints(a, 2, { physical: false })).toBe(false);
    expect(canSpendActionPoints(a, 2, { physical: false, sustained: true })).toBe(true);
    expect(apSpendGate(a, 2, { physical: false }).title).toContain("вдвое");
  });

  it("поле ослабло до 2, без Черты — обычная цена", () => {
    expect(effectiveApCost(ogryn({ field: 2 }), 1, { physical: false })).toBe(1);
    expect(effectiveApCost(ogryn({ field: 7, items: [] }), 1, { physical: false })).toBe(1);
  });

  it("Длительное ментальное — вдвое больше Ходов, Ход по-прежнему 2 ОД", async () => {
    const a = ogryn({ field: 4 });
    inOwnTurn(a);
    const row = await beginSustainedAction(a, { label: "Вспомнить приказ", kind: "long", threshold: 3, physical: false });
    expect(row.threshold).toBe(6);
    expect(a.system.actionPoints.value).toBe(0);
    const b = ogryn({ field: 4 });
    inOwnTurn(b);
    const phys = await beginSustainedAction(b, { label: "Копать", kind: "long", threshold: 3, physical: true });
    expect(phys.threshold).toBe(3);
  });
});

describe("поле как область: выход снимает сбой", () => {
  const scene = { id: "s1", grid: { size: 100, distance: 1 } };
  const tokenAt = (actor, x) => ({ actor, x, y: 0, width: 1, height: 1, parent: scene });

  it("попадание Haywire (3) запоминает центр у цели и радиус", async () => {
    const a = ogryn();
    a.token = tokenAt(a, 0);
    const note = await applyHaywireToBoneHead(a, 8, 3);
    expect(a.getFlag(NS, HAYWIRE_AREA_FLAG)).toEqual({ sceneId: "s1", x: 50, y: 50, radius: 3, dazed: true });
    expect(note).toContain("3 м");
  });

  it("вышел за радиус — поле и Ступор этого поля сняты, карточка в чат", async () => {
    const a = ogryn({ conditions: {} });
    a.token = tokenAt(a, 0);
    await applyHaywireToBoneHead(a, 8, 3);
    expect(a.system.conditions.dazed).toBe(true);
    await checkHaywireFieldExit(tokenAt(a, 200));
    expect(a.getFlag(NS, HAYWIRE_FIELD_FLAG)).toBe(8);
    await checkHaywireFieldExit(tokenAt(a, 400));
    expect(a.getFlag(NS, HAYWIRE_FIELD_FLAG)).toBeUndefined();
    expect(a.getFlag(NS, HAYWIRE_AREA_FLAG)).toBeUndefined();
    expect(a.system.conditions.dazed).toBe(false);
    expect(a.effects.some(e => e.statuses?.includes?.("dazed"))).toBe(false);
    expect(implantDisrupted(a)).toBe(false);
    expect(captured.chat.at(-1).content).toContain("вышел из поля Haywire");
  });

  it("чужой Ступор (не от этого поля) не трогается", async () => {
    const a = ogryn({ conditions: { dazed: true } });
    a.token = tokenAt(a, 0);
    await applyHaywireToBoneHead(a, 5, 3);
    await checkHaywireFieldExit(tokenAt(a, 400));
    expect(a.getFlag(NS, HAYWIRE_FIELD_FLAG)).toBeUndefined();
    expect(a.system.conditions.dazed).toBe(true);
  });

  it("Haywire (0) — привязан к цели: области нет, уйти нельзя", async () => {
    const a = ogryn();
    a.token = tokenAt(a, 0);
    const note = await applyHaywireToBoneHead(a, 5, 0);
    expect(a.getFlag(NS, HAYWIRE_AREA_FLAG)).toBeUndefined();
    expect(note).toContain("Haywire (0)");
    await checkHaywireFieldExit(tokenAt(a, 5000));
    expect(a.getFlag(NS, HAYWIRE_FIELD_FLAG)).toBe(5);
  });

  it("поле погасло затуханием — область стирается вместе с ним", async () => {
    const a = ogryn();
    a.token = tokenAt(a, 0);
    await applyHaywireToBoneHead(a, 4, 3);
    await a.update({ [`flags.${NS}.-=${HAYWIRE_FIELD_FLAG}`]: null });
    await checkHaywireFieldExit(tokenAt(a, 50));
    expect(a.getFlag(NS, HAYWIRE_AREA_FLAG)).toBeUndefined();
    expect(captured.chat).toHaveLength(0);
  });

  it("другая сцена — не выход", async () => {
    const a = ogryn();
    a.token = tokenAt(a, 0);
    await applyHaywireToBoneHead(a, 4, 3);
    await checkHaywireFieldExit({ actor: a, x: 5000, y: 0, width: 1, height: 1, parent: { id: "s2", grid: scene.grid } });
    expect(a.getFlag(NS, HAYWIRE_FIELD_FLAG)).toBe(4);
  });
});
