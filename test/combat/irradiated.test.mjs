// test/combat/irradiated.test.mjs
//
// Облучённый / Irradiated (Дар Нургла, wdbc-1rno): аура 3 м бьёт попаданием
// Рад(1d10) в начале Хода каждой жертвы; носитель сам неуязвим к радиации.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  radAuraOutcome, canTakeRadiation, irradiatedSourcesNear,
  processIrradiatedTurnStart, IRRADIATED
} from "../../module/combat/irradiated.mjs";

function giftItems(key) {
  return key ? [{
    id: "gift", type: "mutation", name: "Irradiated",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }] : [];
}

/** Актор жертвы + носители Дара рядом (все в одной клетке — проверяется не геометрия). */
function scene({ victimGift = null, victimImmune = false, absorption = 0, tTotal = 40,
                 sources = [], conditions = {} } = {}) {
  const items = giftItems(victimGift);
  if (victimImmune) items.push({
    id: "imm", type: "trait", name: "Иммунитет",
    flags: { "warhammer-dbc": { mechanics: [{ id: "gi", operator: "AND", entries: [
      { id: "ei", kind: "condition", condKey: "radiation", condMode: "immunity" }
    ] }] } }
  });
  const updates = [];
  const victim = {
    name: "Жертва", type: "character",
    system: {
      conditions: { ...conditions },
      absorption: { body: absorption },
      characteristics: { t: { total: tTotal } }
    },
    items: Object.assign(items.slice(), { contents: items }),
    updates,
    update: async patch => { updates.push(patch); }
  };
  const tokens = [];
  const self = { id: "self", hidden: false, actor: victim, x: 0, y: 0, width: 1, height: 1 };
  tokens.push(self);
  sources.forEach((s, i) => {
    const si = giftItems(s.gift === undefined ? IRRADIATED : s.gift);
    tokens.push({
      id: `s${i}`, hidden: false, x: 0, y: 0, width: 1, height: 1,
      actor: {
        name: s.name ?? `Чемпион ${i}`, type: "character",
        system: { corruptionBonus: s.corB ?? 0 },
        items: Object.assign(si.slice(), { contents: si })
      }
    });
  });
  const parent = { tokens: Object.assign(tokens.slice(), { contents: tokens }), grid: { size: 100, distance: 1, type: 0 } };
  for (const t of tokens) t.parent = parent;
  return { victim, token: self };
}

describe("radAuraOutcome", () => {
  it("непоглощённый остаток ≥ рейтинга Рад — тест нужен", () => {
    expect(radAuraOutcome(8, 3, 4)).toEqual({ unsoaked: 5, triggersTest: true });
  });
  it("ровно на пороге — всё ещё срабатывает (книга говорит «≥ X»)", () => {
    expect(radAuraOutcome(8, 3, 5).triggersTest).toBe(true);
  });
  it("броня съела всё — теста нет и остаток не уходит в минус", () => {
    expect(radAuraOutcome(3, 9, 1)).toEqual({ unsoaked: 0, triggersTest: false });
  });
  it("рейтинг Рад 0 не срабатывает никогда", () => {
    expect(radAuraOutcome(20, 0, 0).triggersTest).toBe(false);
  });
});

describe("canTakeRadiation", () => {
  it("персонаж — да, техника без Состояний — нет", () => {
    expect(canTakeRadiation({ system: { conditions: {} } })).toBe(true);
    expect(canTakeRadiation({ system: {} })).toBe(false);
  });
});

describe("irradiatedSourcesNear", () => {
  it("видит только носителей Дара, посторонних рядом не считает", () => {
    const { token } = scene({ sources: [{ corB: 4 }, { gift: null }] });
    expect(irradiatedSourcesNear(token)).toHaveLength(1);
  });
});

describe("processIrradiatedTurnStart", () => {
  // captured.dice — очередь выпадающих кубов заглушки: первый уходит в
  // Рад(1d10), второй (если попадание пробило) — в тест T+0.
  beforeEach(() => { resetCaptured(); captured.dice = []; });

  it("пробившее облучение и провал теста T — +1 уровень Радиации", async () => {
    const { victim, token } = scene({ absorption: 0, tTotal: 40, sources: [{ corB: 10 }] });
    captured.dice = [6, 99]; // Рад(6) против 10 непоглощённых — пробило; тест 99 > 40 — провал
    await processIrradiatedTurnStart(victim, token);
    expect(victim.updates).toHaveLength(1);
    expect(victim.updates[0]["system.conditions.radiationLevel"]).toBe(1);
    expect(victim.updates[0]["system.conditions.radiation"]).toBe(true);
  });

  it("облучение пробило, но тест T пройден — Состояние не накладывается", async () => {
    const { victim, token } = scene({ absorption: 0, tTotal: 40, sources: [{ corB: 10 }] });
    captured.dice = [6, 12];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.updates).toEqual([]);
  });

  it("броня держит Cor.b целиком — до теста дело не доходит (второй куб не тратится)", async () => {
    const { victim, token } = scene({ absorption: 99, tTotal: 40, sources: [{ corB: 3 }] });
    captured.dice = [1];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.updates).toEqual([]);
    expect(captured.dice).toEqual([]);
  });

  it("сам носитель Дара своей аурой не облучается", async () => {
    const { victim, token } = scene({ victimGift: IRRADIATED, sources: [{ corB: 10 }] });
    await processIrradiatedTurnStart(victim, token);
    expect(victim.updates).toEqual([]);
    expect(captured.rolls).toEqual([]);
  });

  it("объявленный иммунитет к Радиации гасит весь эффект", async () => {
    const { victim, token } = scene({ victimImmune: true, sources: [{ corB: 10 }] });
    await processIrradiatedTurnStart(victim, token);
    expect(victim.updates).toEqual([]);
    expect(captured.rolls).toEqual([]);
  });

  it("носителей рядом нет — ничего не происходит", async () => {
    const { victim, token } = scene({ sources: [{ gift: null }] });
    await processIrradiatedTurnStart(victim, token);
    expect(victim.updates).toEqual([]);
    expect(captured.rolls).toEqual([]);
  });

  it("два носителя рядом — два независимых попадания, уровни складываются", async () => {
    const { victim, token } = scene({ absorption: 0, tTotal: 40, sources: [{ corB: 10 }, { corB: 10 }] });
    captured.dice = [6, 99, 6, 99];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.updates[0]["system.conditions.radiationLevel"]).toBe(2);
  });

  it("уровни копятся поверх уже имеющейся дозы", async () => {
    const { victim, token } = scene({
      absorption: 0, tTotal: 40, sources: [{ corB: 10 }],
      conditions: { radiation: true, radiationLevel: 4 }
    });
    captured.dice = [6, 99];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.updates[0]["system.conditions.radiationLevel"]).toBe(5);
  });
});
