// test/rules/ethereal-swarm.test.mjs
//
// Ethereal Swarm / Эфирная Стая (Дар Тзинч, wdbc-1rno): Inf.b призрачных
// Крикунов на Cor.b минут, хранится на защищающемся flags.warhammer-dbc.
// etherealSwarm = {count, expiresAt} (worldTime секунды). Чистая логика —
// призыв/остаток/списание одного Крикуна; сам призыв script-кнопкой и
// поглощение попадания в бою — test/combat/defense-ethereal-swarm.test.mjs.

import { describe, it, expect } from "vitest";
import { activeSwarm, summonSwarm, consumeSwarmScreamer } from "../../module/rules/ethereal-swarm.mjs";

function mockActor() {
  const flags = { "warhammer-dbc": {} };
  return {
    getFlag: (sc, k) => flags[sc]?.[k],
    setFlag: async (sc, k, v) => { (flags[sc] ??= {})[k] = v; }
  };
}

describe("activeSwarm", () => {
  it("не призывалась — null", () => {
    expect(activeSwarm(mockActor(), 1000)).toBeNull();
  });

  it("призвана, count>0, worldTime до истечения — отдаёт запись", async () => {
    const actor = mockActor();
    await summonSwarm(actor, 4, 10, 1000); // 10 минут = 600 секунд
    expect(activeSwarm(actor, 1000)).toEqual({ count: 4, expiresAt: 1600 });
    expect(activeSwarm(actor, 1599)).toEqual({ count: 4, expiresAt: 1600 });
  });

  it("worldTime достиг/превысил expiresAt — истекла", async () => {
    const actor = mockActor();
    await summonSwarm(actor, 4, 10, 1000);
    expect(activeSwarm(actor, 1600)).toBeNull();
    expect(activeSwarm(actor, 2000)).toBeNull();
  });

  it("count дошёл до 0 — null, даже если срок не истёк", async () => {
    const actor = mockActor();
    await summonSwarm(actor, 1, 10, 1000);
    await consumeSwarmScreamer(actor);
    expect(activeSwarm(actor, 1000)).toBeNull();
  });
});

describe("summonSwarm", () => {
  it("перезаписывает прошлый остаток свежим (новый призыв — не суммирование)", async () => {
    const actor = mockActor();
    await summonSwarm(actor, 4, 10, 1000);
    await consumeSwarmScreamer(actor);
    await summonSwarm(actor, 2, 5, 2000);
    expect(activeSwarm(actor, 2000)).toEqual({ count: 2, expiresAt: 2300 });
  });

  it("отрицательные/дробные вход — усечены до неотрицательного целого/секунд", async () => {
    const actor = mockActor();
    await summonSwarm(actor, 3.7, -5, 1000);
    // minutes отрицательное усекается до 0 — срок истекает СРАЗУ (expiresAt
    // == worldTime самого призыва), поэтому проверяем момент ДО него.
    expect(actor.getFlag("warhammer-dbc", "etherealSwarm")).toEqual({ count: 3, expiresAt: 1000 });
    expect(activeSwarm(actor, 999)).toEqual({ count: 3, expiresAt: 1000 });
    expect(activeSwarm(actor, 1000)).toBeNull();
  });
});

describe("consumeSwarmScreamer", () => {
  it("списывает ровно одного Крикуна, не трогая срок", async () => {
    const actor = mockActor();
    await summonSwarm(actor, 3, 10, 1000);
    await consumeSwarmScreamer(actor);
    expect(activeSwarm(actor, 1000)).toEqual({ count: 2, expiresAt: 1600 });
  });

  it("пустой/отсутствующий остаток — no-op", async () => {
    const actor = mockActor();
    await consumeSwarmScreamer(actor); // не призывалась вовсе
    expect(activeSwarm(actor, 1000)).toBeNull();
    await summonSwarm(actor, 1, 10, 1000);
    await consumeSwarmScreamer(actor);
    await consumeSwarmScreamer(actor); // уже 0 — не должен уйти в минус
    expect(actor.getFlag("warhammer-dbc", "etherealSwarm").count).toBe(0);
  });
});
