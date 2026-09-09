// test/combat/turn-state-shield.test.mjs
//
// Щит по состоянию Хода (wdbc-1rno): Щит Праздности/Дар Нургла — не
// перегружающийся щит-дефлектор 1-77 за Ход с непотраченным полудействием,
// 1-99 за Ход, где действий не тратили вовсе; Кровопомазанник/Дар Кхорна —
// щит 1-44 ТОЛЬКО от стрелковых атак, если не стрелял и связан в рукопашной.
// module/combat/turn-state-shield.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  shieldOfSlothRating, turnStateShieldIds, clearTurnStateShields,
  processTurnStateShieldsTurnEnd, bloodAnointedRating,
  SHIELD_OF_SLOTH, BLOOD_ANOINTED, RANGED_ONLY_FLAG
} from "../../module/combat/turn-state-shield.mjs";

/** Актор с Мутацией, несущей запись Конструктора kind:"capability" — так возможность и выдаётся в паке. */
function actorWith({ key = SHIELD_OF_SLOTH, ap = 0, apMax = 2, type = "character", shields = [],
                      weapons = [], attackedIds = [] } = {}) {
  const created = [];
  const deleted = [];
  const shieldItems = shields.map((s, i) => ({
    id: `sh${i}`, type: "forcefield", name: s.name ?? "щит",
    getFlag: (scope, k) => (s.mark && k === "turnStateShield" && scope === "warhammer-dbc" ? s.mark : undefined)
  }));
  const weaponItems = weapons.map(w => ({ id: w.id, type: "weapon", name: w.id, system: { weaponClass: w.weaponClass } }));
  const items = [...shieldItems, ...weaponItems];
  if (key) items.push({
    id: "gift", name: "Shield of Sloth / Щит Праздности", type: "mutation",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } },
    getFlag: (scope, k) => (scope === "warhammer-dbc" && k === "mechanics"
      ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key, label: "" }] }]
      : undefined)
  });
  const itemsColl = Object.assign(items.slice(), {
    contents: items, get: id => items.find(i => i.id === id)
  });
  const flagStore = { "warhammer-dbc": attackedIds.length ? { attackedThisTurn: attackedIds } : {} };
  return {
    type,
    system: { actionPoints: { value: ap, max: apMax } },
    items: itemsColl,
    created, deleted,
    getFlag: (scope, k) => flagStore[scope]?.[k],
    createEmbeddedDocuments: async (_t, docs) => { created.push(...docs); },
    deleteEmbeddedDocuments: async (_t, ids) => { deleted.push(...ids); }
  };
}

const HOSTILE = -1, FRIENDLY = 1;

/**
 * Токен-заглушка — та же форма, что test/combat/free-attack.test.mjs::token.
 * enemyContactTokenDocs фильтрует по личному масштабу актора (BASE_SIZE_TYPES),
 * поэтому актор по умолчанию НЕ null, а character — иначе геометрия контакта
 * молча отфильтровывает токен как «не личный масштаб».
 */
function token({ id, x = 0, y = 0, width = 2, height = 2, disposition = HOSTILE, actor = { type: "character" } } = {}) {
  return { document: { id, x, y, width, height, disposition, actor } };
}

beforeEach(() => { globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } }; });

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

// Кровопомазанник (Дар Кхорна): «если не стрелял и либо связан в рукопашной,
// либо шёл к противнику — щит-дефлектор 1-44 (1-88 в крови) от стрелковых
// атак/взрывов». «Шёл к противнику» и эскалация «в крови» не проверяются —
// движок не хранит нужных данных (см. комментарий в самом module).
describe("bloodAnointedRating", () => {
  it("не стрелял, связан в рукопашной — рейтинг 44", () => {
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [mover, enemy];
    const actor = actorWith({ key: null, weapons: [{ id: "w1", weaponClass: "melee" }], attackedIds: ["w1"] });

    expect(bloodAnointedRating(actor, mover.document)).toBe(44);
  });

  it("стрелял (нерукопашное оружие в attackedThisTurn) — щита нет, даже связан", () => {
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [mover, enemy];
    const actor = actorWith({ key: null, weapons: [{ id: "w1", weaponClass: "ranged" }], attackedIds: ["w1"] });

    expect(bloodAnointedRating(actor, mover.document)).toBeNull();
  });

  it("не стрелял, но враг далеко (не связан) — щита нет: «шёл к врагу» не проверяется", () => {
    const enemy = token({ id: "e", x: 30, y: 30, disposition: HOSTILE });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [mover, enemy];
    const actor = actorWith({ key: null });

    expect(bloodAnointedRating(actor, mover.document)).toBeNull();
  });

  it("не стрелял, связан только с союзником (не врагом) — щита нет", () => {
    const ally = token({ id: "a", x: 2, y: 0, disposition: FRIENDLY });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [mover, ally];
    const actor = actorWith({ key: null });

    expect(bloodAnointedRating(actor, mover.document)).toBeNull();
  });

  it("нет токена на сцене — щита нет, не падает", () => {
    const actor = actorWith({ key: null });
    expect(bloodAnointedRating(actor, null)).toBeNull();
  });

  it("attackedThisTurn пуст (весь Ход без единой атаки) — «не стрелял» выполнено", () => {
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [mover, enemy];
    const actor = actorWith({ key: null });

    expect(bloodAnointedRating(actor, mover.document)).toBe(44);
  });
});

describe("processTurnStateShieldsTurnEnd — Кровопомазанник", () => {
  it("условие выполнено — щит с флагом «только от стрелковых» (RANGED_ONLY_FLAG)", async () => {
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [mover, enemy];
    const actor = actorWith({ key: BLOOD_ANOINTED });

    await processTurnStateShieldsTurnEnd(actor, mover.document);

    expect(actor.created).toHaveLength(1);
    const doc = actor.created[0];
    expect(doc.system.currentRating).toBe(44);
    expect(doc.flags["warhammer-dbc"].turnStateShield).toBe(BLOOD_ANOINTED);
    expect(doc.flags["warhammer-dbc"][RANGED_ONLY_FLAG]).toBe(true);
  });

  it("условие не выполнено (не связан) — щита нет", async () => {
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [mover];
    const actor = actorWith({ key: BLOOD_ANOINTED });

    await processTurnStateShieldsTurnEnd(actor, mover.document);
    expect(actor.created).toEqual([]);
  });

  it("нет ни одного из двух Даров — щита нет", async () => {
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY });
    canvas.tokens.placeables = [mover, enemy];
    const actor = actorWith({ key: null });

    await processTurnStateShieldsTurnEnd(actor, mover.document);
    expect(actor.created).toEqual([]);
  });
});
