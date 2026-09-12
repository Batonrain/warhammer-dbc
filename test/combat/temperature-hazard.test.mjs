// test/combat/temperature-hazard.test.mjs
//
// Тест на Жару/Холод (wdbc-1rno) — rollTempHazardTest: температура сцены
// (constants/environment.mjs::tempEffect через constants/scene-nexus.mjs)
// как реальный источник теста T, worldTime-кулдаун (тот же приём, что
// Лучевая болезнь), провал даёт +1 Усталости, Бриз освобождает целиком.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rollTempHazardTest } from "../../module/combat/temperature-hazard.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function makeActor({ t = 40, fatigue = 0 } = {}) {
  const flags = {};
  const actor = {
    name: "Подставной",
    system: { characteristics: { t: { total: t } }, fatigue: { value: fatigue } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(.+)$/);
        if (m) { flags[m[1]] = v; continue; }
        const parts = path.split(".");
        let node = actor;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    }
  };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { scene: null };
  globalThis.game.scenes = { current: { getFlag: () => null } };
  globalThis.game.time = { worldTime: 0 };
});

describe("rollTempHazardTest", () => {
  it("температура комфортная — тест не нужен, ничего не катается", async () => {
    globalThis.game.scenes.current = { getFlag: () => ({ temp: 20 }) };
    const actor = makeActor();
    await rollTempHazardTest(actor);
    expect(captured.chat).toHaveLength(0);
  });

  it("экстремальная жара, успех — карточка, Усталость не растёт, таймер выставлен", async () => {
    globalThis.game.scenes.current = { getFlag: () => ({ temp: 65 }) }; // −20 к T, «каждый Ход»
    const actor = makeActor({ t: 90, fatigue: 0 });
    captured.nextRoll = 50; // 90−20=70 порог, 50<=70 успех
    globalThis.game.time.worldTime = 1000;

    await rollTempHazardTest(actor);

    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Успех");
    expect(actor.system.fatigue.value).toBe(0);
    expect(actor.getFlag("warhammer-dbc", "tempHazardTestAt")).toBe(1000);
  });

  it("экстремальный холод, провал — +1 Усталости", async () => {
    globalThis.game.scenes.current = { getFlag: () => ({ temp: -40 }) }; // −20 к T
    const actor = makeActor({ t: 30, fatigue: 2 });
    captured.nextRoll = 90; // 30−20=10 порог, 90>10 провал
    globalThis.game.time.worldTime = 500;

    await rollTempHazardTest(actor);

    expect(captured.chat[0].content).toContain("Провал");
    expect(actor.system.fatigue.value).toBe(3);
  });

  it("кулдаун ещё не истёк — предупреждение, тест не катается", async () => {
    globalThis.game.scenes.current = { getFlag: () => ({ temp: 65 }) }; // «каждый Ход» = 6 сек
    const actor = makeActor();
    await actor.setFlag("warhammer-dbc", "tempHazardTestAt", 100);
    globalThis.game.time.worldTime = 103; // прошло 3 сек < 6

    await rollTempHazardTest(actor);

    expect(captured.chat).toHaveLength(0);
    expect(captured.warnings.some(w => w.includes("не время"))).toBe(true);
  });

  it("кулдаун истёк — тест снова доступен", async () => {
    globalThis.game.scenes.current = { getFlag: () => ({ temp: 65 }) };
    const actor = makeActor();
    await actor.setFlag("warhammer-dbc", "tempHazardTestAt", 100);
    globalThis.game.time.worldTime = 107; // прошло 7 сек >= 6
    captured.nextRoll = 1;

    await rollTempHazardTest(actor);

    expect(captured.chat).toHaveLength(1);
  });

  describe("Бриз/Breeze (wdbc-1rno) — полный иммунитет", () => {
    const saved = getRuleSources();
    afterEach(() => {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    });

    it("носитель Бриза — тест не катается вовсе, даже в экстремальной температуре", async () => {
      globalThis.game.scenes.current = { getFlag: () => ({ temp: 65 }) };
      const actor = makeActor();
      clearRuleSources();
      registerRuleSource("test", a => a === actor
        ? [{ id: "test.breeze", when: {}, effects: [{ kind: "grantFlag", target: "mutation.breeze" }] }]
        : []);

      await rollTempHazardTest(actor);

      expect(captured.chat).toHaveLength(0);
      expect(actor.getFlag("warhammer-dbc", "tempHazardTestAt")).toBeUndefined();
    });
  });
});
