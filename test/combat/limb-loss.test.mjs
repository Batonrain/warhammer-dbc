// test/combat/limb-loss.test.mjs
//
// wdbc-1rno.6 (стр. 30-31): Foundry-обвязка над module/rules/limb-loss.mjs —
// планирование/снятие таймера обрубка и его розыгрыш по updateWorldTime
// (тот же приём GM-гейта, что apps/wrapped-in-chaos.mjs::sweepSweetMistExpiry).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  scheduleLimbLossGangreneFields, clearLimbLossGangreneFields, sweepLimbLossGangrene
} from "../../module/combat/limb-loss.mjs";

function makeActor(name = "Носитель", conditions = {}, tb = 3) {
  const actor = {
    name, system: { characteristics: { t: { bonus: tb } }, conditions: { ...conditions } },
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

describe("scheduleLimbLossGangreneFields", () => {
  afterEach(() => { delete globalThis.game.time; });

  it("патч на worldTime + T.b дней", () => {
    globalThis.game.time = { worldTime: 1000 };
    const actor = makeActor("Раненый", {}, 3);
    expect(scheduleLimbLossGangreneFields(actor, "lostHands"))
      .toEqual({ "system.conditions.lostHandsGangreneAt": 1000 + 3 * 86400 });
  });

  it("чужой ключ Состояния — пустой патч", () => {
    globalThis.game.time = { worldTime: 1000 };
    expect(scheduleLimbLossGangreneFields(makeActor(), "bleeding")).toEqual({});
  });

  it("нет актора — пустой патч, без падения", () => {
    globalThis.game.time = { worldTime: 1000 };
    expect(scheduleLimbLossGangreneFields(null, "lostHands")).toEqual({});
  });
});

describe("clearLimbLossGangreneFields", () => {
  it("снимает таймер (поле в 0)", () => {
    expect(clearLimbLossGangreneFields("lostEyes")).toEqual({ "system.conditions.lostEyesGangreneAt": 0 });
  });
  it("чужой ключ — пустой патч", () => {
    expect(clearLimbLossGangreneFields("bleeding")).toEqual({});
  });
});

describe("sweepLimbLossGangrene", () => {
  afterEach(() => { delete globalThis.game.actors; delete globalThis.game.users; delete globalThis.game.user; });

  it("основной ГМ, просроченный таймер, неудачный бросок (>8) — снимает таймер, Гангрены нет", async () => {
    captured.dice = [9]; // 1d10 = 9 → 9-10 безопасно (80% = 1-8)
    const actor = makeActor("Раненый", { lostHands: true, lostHandsCount: 1, lostHandsGangreneAt: 1000 });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.conditions.lostHandsGangreneAt).toBe(0);
    expect(actor.system.conditions.gangrene).toBeUndefined();
    expect(captured.chat).toHaveLength(1);
  });

  it("основной ГМ, просроченный таймер, неудачный бросок (≤8) — накладывает Гангрену", async () => {
    captured.dice = [3];
    const actor = makeActor("Раненый", { lostLegs: true, lostLegsCount: 1, lostLegsGangreneAt: 1000 });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.conditions.lostLegsGangreneAt).toBe(0);
    expect(actor.system.conditions.gangrene).toBe(true);
  });

  it("срок ещё не наступил — не трогает", async () => {
    const actor = makeActor("Раненый", { lostHands: true, lostHandsGangreneAt: 2000 });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.conditions.lostHandsGangreneAt).toBe(2000);
    expect(captured.chat).toHaveLength(0);
  });

  it("не основной ГМ (другой клиент) — ничего не делает", async () => {
    const actor = makeActor("Раненый", { lostHands: true, lostHandsGangreneAt: 1000 });
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "player1" } });

    await sweepLimbLossGangrene(1500);

    expect(actor.system.conditions.lostHandsGangreneAt).toBe(1000);
  });
});
