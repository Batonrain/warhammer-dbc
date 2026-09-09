// test/combat/turn-state-shield.test.mjs
//
// Щит по состоянию Хода (wdbc-1rno): Щит Праздности/Дар Нургла — не
// перегружающийся щит-дефлектор 1-77 за Ход с непотраченным полудействием,
// 1-99 за Ход, где действий не тратили вовсе. module/combat/turn-state-shield.mjs.

import { describe, it, expect } from "vitest";
import {
  shieldOfSlothRating, turnStateShieldIds, clearTurnStateShields,
  processTurnStateShieldsTurnEnd, SHIELD_OF_SLOTH
} from "../../module/combat/turn-state-shield.mjs";

/** Актор с Мутацией, несущей запись Конструктора kind:"capability" — так возможность и выдаётся в паке. */
function actorWith({ key = SHIELD_OF_SLOTH, ap = 0, apMax = 2, type = "character", shields = [] } = {}) {
  const created = [];
  const deleted = [];
  const items = shields.map((s, i) => ({
    id: `sh${i}`, type: "forcefield", name: s.name ?? "щит",
    getFlag: (scope, k) => (s.mark && k === "turnStateShield" && scope === "warhammer-dbc" ? s.mark : undefined)
  }));
  if (key) items.push({
    id: "gift", name: "Shield of Sloth / Щит Праздности", type: "mutation",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } },
    getFlag: (scope, k) => (scope === "warhammer-dbc" && k === "mechanics"
      ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key, label: "" }] }]
      : undefined)
  });
  const itemsColl = Object.assign(items.slice(), { contents: items });
  return {
    type,
    system: { actionPoints: { value: ap, max: apMax } },
    items: itemsColl,
    created, deleted,
    createEmbeddedDocuments: async (_t, docs) => { created.push(...docs); },
    deleteEmbeddedDocuments: async (_t, ids) => { deleted.push(...ids); }
  };
}

describe("shieldOfSlothRating", () => {
  it("весь пул ОД на месте — рейтинг 99", () => {
    expect(shieldOfSlothRating(2, 2)).toBe(99);
  });
  it("осталось одно полудействие из двух — рейтинг 77", () => {
    expect(shieldOfSlothRating(1, 2)).toBe(77);
  });
  it("ОД потрачены полностью — щита нет", () => {
    expect(shieldOfSlothRating(0, 2)).toBe(null);
  });
  it("надбавка ОД (Решительность Сражаться) поднимает и планку «вовсе не тратил»", () => {
    // 3 ОД максимум: 2 оставшихся — это уже потраченное полудействие, не 99.
    expect(shieldOfSlothRating(2, 3)).toBe(77);
    expect(shieldOfSlothRating(3, 3)).toBe(99);
  });
});

describe("turnStateShieldIds / clearTurnStateShields", () => {
  it("видит только помеченные щиты, обычные не трогает", async () => {
    const actor = actorWith({ shields: [{ mark: SHIELD_OF_SLOTH }, {}] });
    expect(turnStateShieldIds(actor)).toEqual(["sh0"]);
    await clearTurnStateShields(actor);
    expect(actor.deleted).toEqual(["sh0"]);
  });
  it("нечего снимать — удаление не зовётся вовсе", async () => {
    const actor = actorWith({ shields: [{}] });
    await clearTurnStateShields(actor);
    expect(actor.deleted).toEqual([]);
  });
});

describe("processTurnStateShieldsTurnEnd", () => {
  it("Ход закончен ничего не потратив — не перегружающийся дефлектор 1-99", async () => {
    const actor = actorWith({ ap: 2, apMax: 2 });
    await processTurnStateShieldsTurnEnd(actor);
    expect(actor.created).toHaveLength(1);
    const doc = actor.created[0];
    expect(doc.type).toBe("forcefield");
    expect(doc.system.currentRating).toBe(99);
    expect(doc.system.overloadThreshold).toBe(0);
    expect(doc.system.shieldType).toBe("deflector");
    expect(doc.system.shieldNature).toBe("warp");
    expect(doc.system.equipped).toBe(true);
    expect(doc.flags["warhammer-dbc"].turnStateShield).toBe(SHIELD_OF_SLOTH);
  });

  it("осталось полудействие — 1-77", async () => {
    const actor = actorWith({ ap: 1, apMax: 2 });
    await processTurnStateShieldsTurnEnd(actor);
    expect(actor.created[0].system.currentRating).toBe(77);
  });

  it("ОД дожжены до нуля — щита нет", async () => {
    const actor = actorWith({ ap: 0, apMax: 2 });
    await processTurnStateShieldsTurnEnd(actor);
    expect(actor.created).toEqual([]);
  });

  it("нет Дара — щита нет даже с полным пулом ОД", async () => {
    const actor = actorWith({ key: null, ap: 2, apMax: 2 });
    await processTurnStateShieldsTurnEnd(actor);
    expect(actor.created).toEqual([]);
  });

  it("тип актора без экономики действий (Орда) — пропускается", async () => {
    const actor = actorWith({ ap: 2, apMax: 2, type: "horde" });
    await processTurnStateShieldsTurnEnd(actor);
    expect(actor.created).toEqual([]);
  });

  it("второй ленивый Ход подряд не копит второй щит — старый снимается", async () => {
    const actor = actorWith({ ap: 2, apMax: 2, shields: [{ mark: SHIELD_OF_SLOTH }] });
    await processTurnStateShieldsTurnEnd(actor);
    expect(actor.deleted).toEqual(["sh0"]);
    expect(actor.created).toHaveLength(1);
  });
});
