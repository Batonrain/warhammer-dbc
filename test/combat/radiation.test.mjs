// test/combat/radiation.test.mjs
//
// Лучевая болезнь (стр. 30-31, wdbc-r5o7.6): «доп. урон в T каждые 8 часов».
// Тот же общий приём worldTime-кулдауна, что и Гангрена (gangrene.test.mjs) —
// здесь фиксированный 1 урон (книга не задаёт кость для этого урона),
// интервал 8 часов, свой флаг radiationSickness/radiationSicknessTestAt.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { radiationSicknessRemaining, useRadiationSicknessTest } from "../../module/combat/radiation.mjs";

const FLAG = "warhammer-dbc";
const SICKNESS_FLAG = "radiationSickness";
const TEST_AT_FLAG = "radiationSicknessTestAt";

function actorWith({ sick = true, charDamageT = 0, testAt } = {}) {
  const flags = {};
  if (sick) flags[SICKNESS_FLAG] = true;
  if (testAt !== undefined) flags[TEST_AT_FLAG] = testAt;
  const actor = {
    id: "actor-1", name: "Тестовый",
    system: { charDamage: { t: charDamageT } },
    getFlag: (_s, k) => flags[k],
    update: async data => {
      captured.updates.push(data);
      if ("system.charDamage.t" in data) actor.system.charDamage.t = data["system.charDamage.t"];
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

describe("radiationSicknessRemaining", () => {
  it("флага (testAt) нет — доступно сейчас", () => {
    expect(radiationSicknessRemaining(null, 100000)).toBe(0);
  });

  it("началось только что — в запасе полных 8 часов", () => {
    expect(radiationSicknessRemaining(100000, 100000)).toBe(8 * 3600);
  });

  it("интервал прошёл — 0 (доступно)", () => {
    expect(radiationSicknessRemaining(100000, 100000 + 8 * 3600)).toBe(0);
  });
});

describe("useRadiationSicknessTest", () => {
  it("нет лучевой болезни — ничего не делает", async () => {
    const actor = actorWith({ sick: false });
    await useRadiationSicknessTest(actor);
    expect(captured.chat).toEqual([]);
    expect(captured.warnings).toEqual([]);
  });

  it("интервал ещё не истёк — предупреждает, урон не наносится", async () => {
    const actor = actorWith({ testAt: 100000 });
    await useRadiationSicknessTest(actor);
    expect(captured.warnings.length).toBe(1);
    expect(actor.system.charDamage.t).toBe(0);
  });

  it("интервал прошёл — 1 урона в T, таймер сбрасывается", async () => {
    const actor = actorWith({ charDamageT: 0, testAt: 100000 - 9 * 3600 });
    await useRadiationSicknessTest(actor);
    expect(actor.system.charDamage.t).toBe(-1);
    expect(actor.getFlag(FLAG, TEST_AT_FLAG)).toBe(100000);
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Лучевая болезнь");
  });

  it("флага testAt не было вовсе — тест проводится сразу", async () => {
    const actor = actorWith({});
    await useRadiationSicknessTest(actor);
    expect(captured.warnings.length).toBe(0);
    expect(actor.system.charDamage.t).toBe(-1);
  });
});
