// test/combat/replicant.test.mjs
//
// Обвязка Черт Репликанта: Генетическое Угасание в единой точке урона в
// Характеристики, часы Крючка Сывороток по времени мира, блок «ТЕЛО».

import { captured } from "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { applyCharDamage } from "../../module/combat/char-damage.mjs";
import { serumHookClock, takeSerum, replicantBodyContext, isReplicantSerum } from "../../module/combat/replicant.mjs";
import { CONDITION_CLOCK_HANDLERS } from "../../module/combat/condition-clock.mjs";
import { SERUM_PERIOD, SERUM_TICK } from "../../module/rules/replicant.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const traitsById = new Map(allPackDocuments("traits").map(({ doc }) => [doc._id, doc]));

function trait(id) {
  const doc = structuredClone(traitsById.get(id));
  const flags = doc.flags["warhammer-dbc"];
  return { ...doc, id, flags: doc.flags,
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; } };
}

function mkActor(items, { t = 40, s = 40, age = 0 } = {}) {
  const flags = {};
  const a = {
    name: "Репликант", items, flags,
    system: { characteristics: { t: { total: t }, s: { total: s } }, charLoss: { s: 0, t: 0 }, charLossAt: {}, bio: { age } },
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async d => {
      for (const [p, v] of Object.entries(d)) {
        const m = p.match(/^system\.charLoss\.(\w+)$/);
        if (m) a.system.charLoss[m[1]] = v;
      }
    }
  };
  return a;
}

const mutation = { type: "mutation", system: { god: "" } };
const gift = { type: "mutation", system: { god: "Кхорн" } };

describe("Генетическое Угасание в applyCharDamage", () => {
  it("+1 за каждую мутацию (Дары не в счёт)", async () => {
    const a = mkActor([trait("s88qmAjylqfRunf9"), mutation, mutation, gift]);
    const res = await applyCharDamage(a, "s", 3);
    expect(res.decay).toBe(2);
    expect(a.system.charLoss.s).toBe(5);
  });
  it("без Черты — урон как есть", async () => {
    const a = mkActor([mutation, mutation]);
    const res = await applyCharDamage(a, "s", 3);
    expect(res.decay).toBe(0);
    expect(a.system.charLoss.s).toBe(3);
  });
});

describe("часы Крючка Сывороток", () => {
  it("стоят в списке часов Состояний", () => {
    expect(CONDITION_CLOCK_HANDLERS.map(h => h.id)).toContain("serumHook");
  });
  it("не отмеченный приём — отсчёт с начала отрезка, без урона", async () => {
    const t = trait("BEIaNeHyHLjqRsUM");
    const a = mkActor([t]);
    await serumHookClock(a, { from: 100, to: 100 + 10 * SERUM_PERIOD });
    expect(t.getFlag("warhammer-dbc", "serumTakenAt")).toBe(100);
    expect(a.system.charLoss).toEqual({ s: 0, t: 0 });
  });
  it("неделя вышла — урон в S и T за каждые 8 ч", async () => {
    const t = trait("BEIaNeHyHLjqRsUM");
    await t.setFlag("warhammer-dbc", "serumTakenAt", 0);
    const prev = captured.nextRoll;
    captured.nextRoll = 3;
    const a = mkActor([t]);
    await serumHookClock(a, { from: SERUM_PERIOD, to: SERUM_PERIOD + 2 * SERUM_TICK });
    // 1d5 заглушки — фиксированное число; 2 тика × 2 Характеристики.
    expect(a.system.charLoss).toEqual({ s: 6, t: 6 });
    const oneTick = mkActor([t]);
    await serumHookClock(oneTick, { from: SERUM_PERIOD, to: SERUM_PERIOD + SERUM_TICK });
    expect(oneTick.system.charLoss).toEqual({ s: 3, t: 3 });
    captured.nextRoll = prev;
  });
  it("«принять сыворотку» — отметка сейчас, у не-Репликанта — ничего", async () => {
    const t = trait("BEIaNeHyHLjqRsUM");
    game.time = { worldTime: 12345 };
    expect(await takeSerum(mkActor([t]), { announce: false })).toBe(true);
    expect(t.getFlag("warhammer-dbc", "serumTakenAt")).toBe(12345);
    expect(await takeSerum(mkActor([]), { announce: false })).toBe(false);
  });
});

describe("блок ТЕЛО", () => {
  it("нет Черт — блока нет", () => {
    expect(replicantBodyContext(mkActor([]))).toBeNull();
  });
  it("предел возраста с учётом мутаций", () => {
    const life = trait("ZOw54CxnCkaULMU1");
    life.flags["warhammer-dbc"].lifespanYears = 18;
    const ctx = replicantBodyContext(mkActor([life, trait("s88qmAjylqfRunf9"), mutation], { age: 7 }));
    expect(ctx.life).toMatchObject({ rolled: true, base: 18, decay: 1, max: 17, left: 10 });
  });
});

describe("Сыворотка Репликанта в Химии", () => {
  it("предмет есть, R0, помечен для Крючка Сывороток", () => {
    const serum = allPackDocuments("chemistry").map(d => d.doc).find(d => d.name.startsWith("Replicant Serum"));
    expect(serum.system.availability).toBe(0);
    expect(serum.system.drugCategory).toBe("medicine");
    expect(isReplicantSerum({ ...serum, getFlag: (s, k) => serum.flags?.[s]?.[k] })).toBe(true);
  });
});
