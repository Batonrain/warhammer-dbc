// test/combat/gangrene.test.mjs
//
// Гангрена (стр. 30-31, wdbc-r5o7.5): «каждые T.b×2 часов — 1d10 урона в T».
// Тот же общий приём worldTime-кулдауна, что и Перевес выключенной силовой
// брони (disabled-armour-periodic-test.test.mjs) — здесь только интервал
// другой (×2 часа вместо ×1) и цель урона другая (system.charDamage.t, не
// Усталость).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { gangrenePeriodicRemaining, useGangrenePeriodicTest, gangreneTick } from "../../module/combat/gangrene.mjs";

const FLAG = "warhammer-dbc";
const TEST_AT_FLAG = "gangreneTestAt";

function actorWith({ tb = 4, tTotal = 40, gangrene = true, charDamageT = 0, testAt, race = "human" } = {}) {
  const flags = {};
  if (testAt !== undefined) flags[TEST_AT_FLAG] = testAt;
  const actor = {
    id: "actor-1", name: "Тестовый", flags, items: [],
    system: {
      race,
      characteristics: { t: { bonus: tb, total: tTotal } },
      conditions: { gangrene },
      charDamage: { t: charDamageT }
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    update: async data => {
      captured.updates.push(data);
      if ("system.charDamage.t" in data) {
        const delta = data["system.charDamage.t"] - actor.system.charDamage.t;
        actor.system.charDamage.t = data["system.charDamage.t"];
        actor.system.characteristics.t.total += delta;
      }
      if ("system.conditions.gangrene" in data) actor.system.conditions.gangrene = data["system.conditions.gangrene"];
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (!m) continue;
        if (m[1]) delete flags[m[2]]; else flags[m[2]] = value;
      }
    }
  };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 100000 };
});

describe("gangrenePeriodicRemaining", () => {
  it("флага (testAt) нет — доступно сейчас", () => {
    expect(gangrenePeriodicRemaining(null, 100000, 4)).toBe(0);
  });

  // wdbc-x1nz.2.96: при T.b=0 книга вырождается («каждые 0 часов») — пол 1 час.
  it("tb=0 — интервал 1 час, а не ноль", () => {
    expect(gangrenePeriodicRemaining(100000, 200000, 0)).toBe(0);
    expect(gangrenePeriodicRemaining(100000, 100000 + 1800, 0)).toBe(1800);
  });

  it("началось только что — в запасе полный интервал T.b×2 часов", () => {
    expect(gangrenePeriodicRemaining(100000, 100000, 4)).toBe(4 * 2 * 3600);
  });

  it("прошло меньше интервала — остаток посчитан верно", () => {
    // tb=4 → интервал 8ч=28800с; прошло 3ч → осталось 5ч.
    expect(gangrenePeriodicRemaining(100000, 100000 + 3 * 3600, 4)).toBe(5 * 3600);
  });

  it("интервал прошёл полностью — 0 (доступно)", () => {
    expect(gangrenePeriodicRemaining(100000, 100000 + 8 * 3600, 4)).toBe(0);
  });
});

describe("useGangrenePeriodicTest", () => {
  it("нет Гангрены — ничего не делает", async () => {
    const actor = actorWith({ gangrene: false });
    await useGangrenePeriodicTest(actor);
    expect(captured.chat).toEqual([]);
    expect(captured.warnings).toEqual([]);
  });

  it("интервал ещё не истёк — предупреждает, урон не наносится", async () => {
    const actor = actorWith({ tb: 4, testAt: 100000 }); // весь интервал впереди
    await useGangrenePeriodicTest(actor);
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
    expect(actor.system.charDamage.t).toBe(0);
  });

  it("интервал прошёл — 1d10 урона в T (вычитается из Мод.), таймер сбрасывается", async () => {
    captured.nextRoll = 6;
    const actor = actorWith({ tb: 4, charDamageT: 0, testAt: 100000 - 9 * 3600 });
    await useGangrenePeriodicTest(actor);
    expect(actor.system.charDamage.t).toBe(-6);
    expect(actor.getFlag(FLAG, TEST_AT_FLAG)).toBe(100000);
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Гангрена");
  });

  it("накопленный урон складывается (Мод. уже отрицательный)", async () => {
    captured.nextRoll = 3;
    const actor = actorWith({ tb: 4, charDamageT: -6, testAt: 100000 - 9 * 3600 });
    await useGangrenePeriodicTest(actor);
    expect(actor.system.charDamage.t).toBe(-9);
  });

  it("флага не было вовсе — тест проводится сразу", async () => {
    captured.nextRoll = 4;
    const actor = actorWith({ tb: 4 }); // testAt отсутствует
    await useGangrenePeriodicTest(actor);
    expect(captured.warnings.length).toBe(0);
    expect(actor.getFlag(FLAG, TEST_AT_FLAG)).toBe(100000);
    expect(actor.system.charDamage.t).toBe(-4);
  });
});

// Сверка «Статусы» (wdbc-x1nz.2.96): «Каждый раз перед броском на урон в Т от
// Гангрены космодесантник проходит тест на Т+0, и при Успехе исцеляется»;
// «…получает 1d10 урона в Т, пока это не убьёт его».
describe("gangreneTick — космодесантник и смерть", () => {
  it("космодесантник: тест Т+0 успешен — Гангрена снята, урона нет", async () => {
    captured.dice = [30]; // 1d100 = 30 ≤ T 40
    const actor = actorWith({ race: "astartes", tTotal: 40 });
    const res = await gangreneTick(actor, { at: 100000 });
    expect(res.healed).toBe(true);
    expect(actor.system.conditions.gangrene).toBe(false);
    expect(actor.system.charDamage.t).toBe(0);
    expect(captured.chat[0].content).toContain("побеждает Гангрену");
  });

  it("космодесантник: тест провален — урон 1d10 как обычно", async () => {
    captured.dice = [90, 5]; // тест 90 > 40, урон 5
    const actor = actorWith({ race: "astartes", tTotal: 40 });
    const res = await gangreneTick(actor, { at: 100000 });
    expect(res.damage).toBe(5);
    expect(actor.system.conditions.gangrene).toBe(true);
    expect(actor.system.charDamage.t).toBe(-5);
  });

  it("человек теста не проходит — сразу урон", async () => {
    captured.dice = [7];
    const actor = actorWith({ tTotal: 40 });
    const res = await gangreneTick(actor, { at: 100000 });
    expect(res.damage).toBe(7);
  });

  it("итоговая T падает до 0 и ниже — смерть (флаг deceased)", async () => {
    captured.dice = [8];
    const actor = actorWith({ tTotal: 6 });
    const res = await gangreneTick(actor, { at: 100000 });
    expect(res.died).toBe(true);
    expect(actor.flags.deceased).toBe(true);
    expect(captured.chat[0].content).toContain("умирает от Гангрены");
  });

  it("T остаётся выше 0 — жив", async () => {
    captured.dice = [3];
    const actor = actorWith({ tTotal: 6 });
    const res = await gangreneTick(actor, { at: 100000 });
    expect(res.died).toBe(false);
    expect(actor.flags.deceased).toBeUndefined();
  });
});
