// test/combat/limb-loss.test.mjs
//
// wdbc-1rno.6 (стр. 30-31): Foundry-обвязка над module/rules/limb-loss.mjs —
// планирование/снятие таймера обрубка и его розыгрыш по updateWorldTime
// (тот же приём GM-гейта, что apps/wrapped-in-chaos.mjs::sweepSweetMistExpiry).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sweepLimbLossGangrene } from "../../module/combat/limb-loss.mjs";
import { lostSideFields, clearStumpTimerFields } from "../../module/rules/limb-loss.mjs";

// scheduleLimbLossGangreneFields/clearLimbLossGangreneFields (по типу конечности,
// без стороны) удалены — с wdbc-x1nz.2.100 таймер обрубка заводится/снимается
// ПО СТОРОНЕ (rules/limb-loss.mjs::lostSideFields/clearStumpTimerFields), чистая
// логика этого куска проверяется там же (test/rules/limb-loss.test.mjs), не здесь.

function makeActor(name = "Носитель", lostLimbs = {}, tb = 3) {
  const actor = {
    name, system: { characteristics: { t: { bonus: tb } }, conditions: {}, lostLimbs: { ...lostLimbs } },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let node = actor;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    }
  };
  return actor;
}

beforeEach(resetCaptured);

describe("sweepLimbLossGangrene", () => {
  afterEach(() => { delete globalThis.game.actors; delete globalThis.game.users; delete globalThis.game.user; });

  it("основной ГМ, просроченный таймер, неудачный бросок (>8) — снимает таймер, Гангрены нет", async () => {
    captured.dice = [9]; // 1d10 = 9 → 9-10 безопасно (80% = 1-8)
    const actor = makeActor("Раненый", { rightHand: { lost: true, gangreneAt: 1000 } });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.lostLimbs.rightHand.gangreneAt).toBe(0);
    expect(actor.system.conditions.gangrene).toBeUndefined();
    expect(captured.chat).toHaveLength(1);
  });

  it("основной ГМ, просроченный таймер, неудачный бросок (≤8) — накладывает Гангрену", async () => {
    captured.dice = [3];
    const actor = makeActor("Раненый", { rightLeg: { lost: true, gangreneAt: 1000 } });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.lostLimbs.rightLeg.gangreneAt).toBe(0);
    expect(actor.system.conditions.gangrene).toBe(true);
  });

  it("срок ещё не наступил — не трогает", async () => {
    const actor = makeActor("Раненый", { rightHand: { lost: true, gangreneAt: 2000 } });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.lostLimbs.rightHand.gangreneAt).toBe(2000);
    expect(captured.chat).toHaveLength(0);
  });

  it("не основной ГМ (другой клиент) — ничего не делает", async () => {
    const actor = makeActor("Раненый", { rightHand: { lost: true, gangreneAt: 1000 } });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "player1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.lostLimbs.rightHand.gangreneAt).toBe(1000);
  });

  // wdbc-x1nz.2.100: таймеры двух сторон независимы — просрочка одной руки
  // не трогает таймер другой, ещё не наступивший.
  it("две стороны с разными сроками — только просроченная снимается, вторая не тронута", async () => {
    captured.dice = [9];
    const actor = makeActor("Раненый", {
      rightHand: { lost: true, gangreneAt: 1000 },
      leftHand:  { lost: true, gangreneAt: 5000 }
    });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.lostLimbs.rightHand.gangreneAt).toBe(0);
    expect(actor.system.lostLimbs.leftHand.gangreneAt).toBe(5000);
    expect(captured.chat).toHaveLength(1);
  });
});

// Сама Foundry-функция lostSideFields/clearStumpTimerFields — чистая логика,
// проверена без заглушки в test/rules/limb-loss.test.mjs; здесь достаточно
// убедиться, что sweep читает и пишет ровно тот путь, который они производят.
describe("lostSideFields / clearStumpTimerFields — путь, который читает sweep", () => {
  it("lostSideFields с timer даёт тот же путь, что видит sweepLimbLossGangrene", () => {
    expect(lostSideFields("lostHands", "right", { timer: true, worldTime: 1000, tb: 3 }))
      .toEqual({ "system.lostLimbs.rightHand.lost": true, "system.lostLimbs.rightHand.gangreneAt": 1000 + 3 * 86400, "system.lostLimbs.rightHand.mutation": false });
  });

  it("clearStumpTimerFields снимает ровно то поле, что обнуляет sweep", () => {
    expect(clearStumpTimerFields("lostLegs", "left")).toEqual({ "system.lostLimbs.leftLeg.gangreneAt": 0 });
  });
});
