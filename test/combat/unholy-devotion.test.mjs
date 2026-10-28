// test/combat/unholy-devotion.test.mjs
//
// Unholy Devotion / Нечестивая Преданность (корбук стр. 113; Sahara
// 3-cross-actor): Миньон Хозяина в пределах Полудвижения проходит A+0 (+30 при
// ≤2 м) и принимает попадание вместо Хозяина, раз в Раунд на Миньона.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import {
  devotionInReach, devotionBonus, devotionThreshold, isMinionOf, UNHOLY_DEVOTION_CAP
} from "../../module/rules/unholy-devotion.mjs";
import {
  unholyDevotionCandidates, rollUnholyDevotion, devotionAvailable
} from "../../module/combat/unholy-devotion.mjs";

const DEFAULT_SOURCES = getRuleSources();

describe("числа книги (rules/unholy-devotion.mjs)", () => {
  it("достаёт, пока расстояние не больше Полудвижения", () => {
    expect(devotionInReach(4, 4)).toBe(true);
    expect(devotionInReach(4, 4.1)).toBe(false);
    expect(devotionInReach(0, 0)).toBe(false);          // Миньон без движения не дотянется
    expect(devotionInReach(undefined, 1)).toBe(false);
    expect(devotionInReach(4, null)).toBe(false);
  });

  it("+30 только при ≤2 м", () => {
    expect(devotionBonus(2)).toBe(30);
    expect(devotionBonus(0.5)).toBe(30);
    expect(devotionBonus(2.1)).toBe(0);
    expect(devotionBonus(null)).toBe(0);
    expect(devotionThreshold(35, 1.5)).toBe(65);
    expect(devotionThreshold(35, 3)).toBe(35);
  });

  it("свой Миньон — по masterUuid и типу", () => {
    const master = { uuid: "Actor.m" };
    expect(isMinionOf({ type: "minion", system: { masterUuid: "Actor.m" } }, master)).toBe(true);
    expect(isMinionOf({ type: "minion", system: { masterUuid: "Actor.x" } }, master)).toBe(false);
    expect(isMinionOf({ type: "character", system: { masterUuid: "Actor.m" } }, master)).toBe(false);
  });
});

const token = (x, y) => ({ document: { x, y, width: 1, height: 1 } });

function minion(uuid, tok, { ag = 35, halfMove = 4 } = {}) {
  const flags = {};
  return {
    uuid, name: uuid, type: "minion", items: [], effects: [],
    system: { masterUuid: "Actor.master", characteristics: { ag: { total: ag } }, movement: { halfMove } },
    getActiveTokens: () => (tok ? [tok] : []),
    getFlag: (ns, k) => flags[`${ns}.${k}`],
    setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; }
  };
}

const master = () => ({ uuid: "Actor.master", name: "Хозяин", type: "character", items: [] });
const grant = (...keys) => {
  clearRuleSources();
  registerRuleSource("test", () => keys.map((f, i) =>
    ({ id: `test.devotion${i}`, when: {}, effects: [{ kind: "grantFlag", target: f }] })));
};

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 1 } } };
  globalThis.game.combat = { round: 1, id: "c1" };
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("unholyDevotionCandidates: кто может прикрыть Хозяина", () => {
  const target = token(0, 0);

  it("только Хозяин с Талантом: без него список пуст", () => {
    grant();
    expect(unholyDevotionCandidates(target, master(), [minion("Actor.a", token(100, 0))])).toEqual([]);
  });

  it("Миньон в пределах Полудвижения — кандидат; дальше — нет; без токена — нет", () => {
    grant(UNHOLY_DEVOTION_CAP);
    const near = minion("Actor.near", token(300, 0), { halfMove: 4 });     // 3 м
    const far = minion("Actor.far", token(600, 0), { halfMove: 4 });       // 6 м
    const noToken = minion("Actor.none", null);
    const res = unholyDevotionCandidates(target, master(), [near, far, noToken]);
    expect(res.map(c => c.uuid)).toEqual(["Actor.near"]);
    expect(res[0]).toMatchObject({ distance: 3, bonus: 0, threshold: 35, available: true });
  });

  it("≤2 м даёт +30 к порогу", () => {
    grant(UNHOLY_DEVOTION_CAP);
    const [c] = unholyDevotionCandidates(target, master(), [minion("Actor.close", token(150, 0), { ag: 35 })]);
    expect(c).toMatchObject({ bonus: 30, threshold: 65 });
  });

  it("чужой Миньон другого Хозяина не прикрывает", () => {
    grant(UNHOLY_DEVOTION_CAP);
    const stranger = minion("Actor.s", token(100, 0));
    stranger.system.masterUuid = "Actor.other";
    expect(unholyDevotionCandidates(target, master(), [stranger])).toEqual([]);
  });

  it("нет токена цели — пусто", () => {
    grant(UNHOLY_DEVOTION_CAP);
    expect(unholyDevotionCandidates(null, master(), [minion("Actor.a", token(100, 0))])).toEqual([]);
  });
});

describe("rollUnholyDevotion: A+0 и «раз в Раунд на Миньона»", () => {
  it("успех: порог A+30 вблизи, попытка потрачена, карточка зовёт применить урон Миньону", async () => {
    const m = minion("Actor.a", token(100, 0), { ag: 35 });
    captured.nextRoll = 60;
    const res = await rollUnholyDevotion(m, 1.5, "Хозяин");
    expect(res).toMatchObject({ success: true, threshold: 65 });
    expect(captured.chat.at(-1).content).toContain("Принимает удар");
    expect(devotionAvailable(m)).toBe(false);
  });

  it("провал: удар достаётся Хозяину, попытка всё равно потрачена", async () => {
    const m = minion("Actor.a", token(300, 0), { ag: 35 });
    captured.nextRoll = 90;
    const res = await rollUnholyDevotion(m, 3);
    expect(res.success).toBe(false);
    expect(res.threshold).toBe(35);
    expect(captured.chat.at(-1).content).toContain("Хозяину");
    expect(devotionAvailable(m)).toBe(false);
  });

  it("вторая попытка в том же Раунде — отказ без броска; в следующем Раунде снова можно", async () => {
    const m = minion("Actor.a", token(100, 0));
    captured.nextRoll = 10;
    await rollUnholyDevotion(m, 1);
    const before = captured.chat.length;
    expect(await rollUnholyDevotion(m, 1)).toBeNull();
    expect(captured.chat.length).toBe(before);
    globalThis.game.combat = { round: 2, id: "c1" };
    expect(devotionAvailable(m)).toBe(true);
  });
});
