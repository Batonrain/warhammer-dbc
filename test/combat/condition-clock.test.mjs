// test/combat/condition-clock.test.mjs
//
// Часы Состояний (wdbc-x1nz.2.95/.96): пробуждение из обморока от Усталости
// и урон Гангрены T.b×2 часов идут по игровому времени Календаря.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  sweepConditionClock, sweepAllConditionClocks, CONDITION_CLOCK_HANDLERS
} from "../../module/combat/condition-clock.mjs";

function makeActor({ fatigue = 0, tb = 4, wb = 3, tTotal = 40, conditions = {}, flags = {}, race = "human" } = {}) {
  const f = { ...flags };
  const a = {
    name: "Носитель", items: [], flags: f,
    system: {
      race,
      fatigue: { value: fatigue, max: tb + wb },
      characteristics: { t: { bonus: tb, total: tTotal }, wp: { bonus: wb } },
      conditions: { ...conditions },
      charDamage: { t: 0 }
    },
    getFlag: (_s, k) => f[k],
    setFlag: async (_s, k, v) => { f[k] = v; return v; },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(.+)$/);
        if (m) { f[m[1]] = v; continue; }
        if (path === "system.charDamage.t") a.system.characteristics.t.total += v - a.system.charDamage.t;
        const parts = path.split(".");
        let node = a;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("устройство", () => {
  it("список обработчиков открыт для новых часовых правил", () => {
    // Порядок значим (см. condition-clock.mjs): пробуждение раньше Гангрены.
    // Остальные часовые правила Состояний дописываются после них.
    expect(CONDITION_CLOCK_HANDLERS.map(h => h.id).slice(0, 2)).toEqual(["fatigueFaint", "gangrene"]);
  });

  it("пустой или обратный отрезок — ничего не делается", async () => {
    const a = makeActor({ fatigue: 9, conditions: { unconscious: true, fatigueFaintWakeAt: 100 } });
    await sweepConditionClock(a, { from: 500, to: 500 });
    await sweepConditionClock(a, { from: 500, to: 100 });
    expect(a.system.conditions.unconscious).toBe(true);
  });
});

describe("обморок от Усталости", () => {
  it("время пробуждения не наступило — спит дальше", async () => {
    const a = makeActor({ fatigue: 7, conditions: { unconscious: true, fatigueFaintWakeAt: 1000 } });
    await sweepConditionClock(a, { from: 0, to: 999 });
    expect(a.system.conditions.unconscious).toBe(true);
    expect(a.system.fatigue.value).toBe(7);
  });

  it("наступило — приходит в себя, Усталость до T.b+W.b−1, карточка", async () => {
    const a = makeActor({ fatigue: 9, conditions: { unconscious: true, fatigueFaintWakeAt: 1000 } });
    await sweepConditionClock(a, { from: 900, to: 1100 });
    expect(a.system.conditions.unconscious).toBe(false);
    expect(a.system.conditions.fatigueFaintWakeAt).toBe(0);
    expect(a.system.fatigue.value).toBe(6);
    expect(captured.chat[0].content).toContain("приходит в себя");
  });

  it("с Гангреной — действующая (хранимая + 1) опускается до порог−1", async () => {
    const a = makeActor({ fatigue: 8, conditions: { unconscious: true, fatigueFaintWakeAt: 1000, gangrene: true },
      flags: { gangreneTestAt: 1000 } });
    await sweepConditionClock(a, { from: 900, to: 1100 });
    expect(a.system.fatigue.value).toBe(5); // 5 + 1 = 6 = 7 − 1
  });

  it("уже очнулся другим путём — таймер только гасится", async () => {
    const a = makeActor({ fatigue: 3, conditions: { unconscious: false, fatigueFaintWakeAt: 1000 } });
    await sweepConditionClock(a, { from: 900, to: 1100 });
    expect(a.system.conditions.fatigueFaintWakeAt).toBe(0);
    expect(a.system.fatigue.value).toBe(3);
    expect(captured.chat).toEqual([]);
  });
});

describe("Гангрена по Календарю", () => {
  it("по тику на каждый истёкший интервал T.b×2 часов", async () => {
    captured.dice = [2, 3];
    const a = makeActor({ tb: 4, conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 16 * 3600 + 5 });
    expect(a.system.charDamage.t).toBe(-5);
    expect(a.flags.gangreneTestAt).toBe(16 * 3600);
  });

  it("интервал не истёк — урона нет", async () => {
    const a = makeActor({ tb: 4, conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 8 * 3600 - 1 });
    expect(a.system.charDamage.t).toBe(0);
  });

  it("нет метки отсчёта — считается с начала отрезка", async () => {
    captured.dice = [4];
    const a = makeActor({ tb: 4, conditions: { gangrene: true } });
    await sweepConditionClock(a, { from: 1000, to: 1000 + 8 * 3600 });
    expect(a.system.charDamage.t).toBe(-4);
  });

  it("космодесантник исцелился на первом тике — дальше урона нет", async () => {
    captured.dice = [10]; // тест Т+0 успешен
    const a = makeActor({ tb: 4, race: "astartes", conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 24 * 3600 });
    expect(a.system.conditions.gangrene).toBe(false);
    expect(a.system.charDamage.t).toBe(0);
  });

  it("T.b = 0 — урон раз в час, а не подряд без паузы", async () => {
    captured.dice = [1, 1];
    const a = makeActor({ tb: 0, tTotal: 9, conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 2 * 3600 + 10 });
    expect(a.system.charDamage.t).toBe(-2);
  });

  it("смерть останавливает часы", async () => {
    captured.dice = [9];
    const a = makeActor({ tb: 1, tTotal: 5, conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 100 * 3600 });
    expect(a.flags.deceased).toBe(true);
    expect(a.system.charDamage.t).toBe(-9);
  });
});

describe("sweepAllConditionClocks", () => {
  afterEach(() => { delete globalThis.game.actors; globalThis.game.users = []; globalThis.game.user = {}; });

  it("только основной ГМ", async () => {
    const a = makeActor({ fatigue: 9, conditions: { unconscious: true, fatigueFaintWakeAt: 1000 } });
    Object.assign(globalThis.game, { actors: [a], users: { activeGM: { id: "gm1" } }, user: { id: "pl1" } });
    await sweepAllConditionClocks(1100, 200);
    expect(a.system.conditions.unconscious).toBe(true);

    globalThis.game.user = { id: "gm1" };
    await sweepAllConditionClocks(1100, 200);
    expect(a.system.conditions.unconscious).toBe(false);
  });
});
