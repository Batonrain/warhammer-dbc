// test/combat/radiation-scene-clock.test.mjs
//
// wdbc-c5vf0: обработчик часов — тики урона в T, доза, тест лучевой болезни,
// кто вообще облучается (Персонаж с токеном на сцене).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const damage = vi.hoisted(() => ({ calls: 0, dies: false }));
vi.mock("../../module/combat/char-damage.mjs", () => ({
  applyCharDamage: async () => {
    damage.calls++;
    return { applied: 1, before: 40 - damage.calls + 1, after: 40 - damage.calls, died: damage.dies && damage.calls >= 3, decay: 0, genome: 0 };
  },
  healCharDamage: async () => 0
}));
const testRoll = vi.hoisted(() => ({ success: true }));
vi.mock("../../module/combat/condition-ticks.mjs", () => ({
  rollConditionCharTest: async () => ({ eff: 40, rv: testRoll.success ? 10 : 90, success: testRoll.success, parts: [] })
}));

import { sceneRadiationClock, radiationExposure } from "../../module/combat/radiation-scene.mjs";

const H = 3600;
function character({ id = "c1", flags = {}, items = [], type = "character" } = {}) {
  const store = { ...flags };
  const actor = {
    id, name: "Герой", type, items, system: {}, updates: [],
    getFlag: (_s, k) => store[k],
    update: async function (d) {
      this.updates.push(d);
      for (const [k, v] of Object.entries(d)) if (k.startsWith("flags.warhammer-dbc.")) store[k.split(".").pop()] = v;
    }
  };
  return actor;
}
function sceneWith(actor, rad) {
  return { id: "s1", name: "Сцена", tokens: [{ id: "tk", actorId: actor.id }], getFlag: (_s, k) => (k === "env" ? { rad } : undefined) };
}

beforeEach(() => {
  resetCaptured();
  damage.calls = 0; damage.dies = false; testRoll.success = true;
  globalThis.game.users = { activeGM: { id: "gm" } };
});
afterEach(() => { globalThis.canvas = {}; });

describe("radiationExposure", () => {
  it("не Персонаж или нет токена на сцене — не облучается", () => {
    const hero = character();
    globalThis.canvas = { scene: sceneWith(character({ id: "other" }), 5) };
    expect(radiationExposure(hero)).toBeNull();
    globalThis.canvas = { scene: sceneWith(hero, 5) };
    expect(radiationExposure(character({ id: "c1", type: "vehicle" }))).toBeNull();
    expect(radiationExposure(hero)).toMatchObject({ level: 5, effective: 5, interval: 1800 });
  });
  it("укрытие из флага снижает интенсивность", () => {
    const hero = character({ flags: { radShelter: "bunker" } });
    globalThis.canvas = { scene: sceneWith(hero, 5) };
    expect(radiationExposure(hero)).toMatchObject({ effective: 2, interval: 4 * H });
  });
});

describe("sceneRadiationClock", () => {
  it("фон 4: за 3 часа три тика урона в T, карточка в чате", async () => {
    const hero = character();
    globalThis.canvas = { scene: sceneWith(hero, 4) };
    await sceneRadiationClock(hero, { from: 0, to: 3 * H });
    expect(damage.calls).toBe(3);
    expect(hero.updates.at(-1)["flags.warhammer-dbc.radDose"]).toBe(3);
    expect(captured.chat.at(-1).content).toContain("Радиация сцены");
  });

  it("укрылся полностью (радиационный бункер) — тиков нет, ничего не пишется", async () => {
    const hero = character({ flags: { radShelter: "radbunker" } });
    globalThis.canvas = { scene: sceneWith(hero, 10) };
    await sceneRadiationClock(hero, { from: 0, to: 10 * H });
    expect(damage.calls).toBe(0);
    expect(hero.updates).toHaveLength(0);
  });

  it("на дозе 10 — тест T+0; провал ставит лучевую болезнь", async () => {
    const hero = character({ flags: { radDose: 8 } });
    globalThis.canvas = { scene: sceneWith(hero, 4) };
    testRoll.success = false;
    await sceneRadiationClock(hero, { from: 0, to: 2 * H });
    expect(hero.updates.at(-1)["flags.warhammer-dbc.radiationSickness"]).toBe(true);
    expect(captured.chat.at(-1).content).toContain("лучевая болезнь");
  });

  it("успех на тесте дозы — болезни нет", async () => {
    const hero = character({ flags: { radDose: 9 } });
    globalThis.canvas = { scene: sceneWith(hero, 4) };
    await sceneRadiationClock(hero, { from: 0, to: H });
    expect(hero.updates.at(-1)["flags.warhammer-dbc.radiationSickness"]).toBeUndefined();
  });

  it("умер на тике — дальше не бьёт и не тестирует", async () => {
    const hero = character();
    globalThis.canvas = { scene: sceneWith(hero, 4) };
    damage.dies = true;
    await sceneRadiationClock(hero, { from: 0, to: 10 * H });
    expect(damage.calls).toBe(3);
    expect(captured.chat.at(-1).content).toContain("умирает");
  });

  it("короткий отрезок только заводит отсчёт, следующий дотикивает", async () => {
    const hero = character();
    globalThis.canvas = { scene: sceneWith(hero, 4) };
    await sceneRadiationClock(hero, { from: 0, to: 30 * 60 });
    expect(damage.calls).toBe(0);
    await sceneRadiationClock(hero, { from: 30 * 60, to: 70 * 60 });
    expect(damage.calls).toBe(1);
  });
});
