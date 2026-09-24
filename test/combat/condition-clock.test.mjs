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
      charDamage: { t: 0 },
      // Урон в Характеристики по книге (wdbc-x1nz.2.83).
      charLoss: { t: 0 }, charLossAt: {}
    },
    getFlag: (_s, k) => f[k],
    setFlag: async (_s, k, v) => { f[k] = v; return v; },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(.+)$/);
        if (m) { f[m[1]] = v; continue; }
        if (path === "system.charLoss.t") a.system.characteristics.t.total -= v - a.system.charLoss.t;
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
    expect(a.system.charLoss.t).toBe(5);
    expect(a.flags.gangreneTestAt).toBe(16 * 3600);
  });

  it("интервал не истёк — урона нет", async () => {
    const a = makeActor({ tb: 4, conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 8 * 3600 - 1 });
    expect(a.system.charLoss.t).toBe(0);
  });

  it("метка старше отрезка (ручная кнопка до часов) — пропущенное не догоняется разом (приёмка #516)", async () => {
    captured.dice = [2, 3, 4, 5];
    const day = 24 * 3600;
    const a = makeActor({ tb: 4, conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 3 * day, to: 3 * day + 2 });
    expect(a.system.charLoss.t).toBe(0);
  });

  it("нет метки отсчёта — считается с начала отрезка", async () => {
    captured.dice = [4];
    const a = makeActor({ tb: 4, conditions: { gangrene: true } });
    await sweepConditionClock(a, { from: 1000, to: 1000 + 8 * 3600 });
    expect(a.system.charLoss.t).toBe(4);
  });

  it("космодесантник исцелился на первом тике — дальше урона нет", async () => {
    captured.dice = [10]; // тест Т+0 успешен
    const a = makeActor({ tb: 4, race: "astartes", conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 24 * 3600 });
    expect(a.system.conditions.gangrene).toBe(false);
    expect(a.system.charLoss.t).toBe(0);
  });

  it("T.b = 0 — урон раз в час, а не подряд без паузы", async () => {
    captured.dice = [1, 1];
    const a = makeActor({ tb: 0, tTotal: 9, conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 2 * 3600 + 10 });
    expect(a.system.charLoss.t).toBe(2);
  });

  it("смерть останавливает часы", async () => {
    captured.dice = [9];
    const a = makeActor({ tb: 1, tTotal: 5, conditions: { gangrene: true }, flags: { gangreneTestAt: 0 } });
    await sweepConditionClock(a, { from: 0, to: 100 * 3600 });
    expect(a.flags.deceased).toBe(true);
    // Пол 0 (wdbc-x1nz.2.83): при T 5 урон 9 записывается как 5.
    expect(a.system.charLoss.t).toBe(5);
  });
});

describe("sweepAllConditionClocks", () => {
  afterEach(() => {
    delete globalThis.game.actors; delete globalThis.game.scenes;
    globalThis.game.users = []; globalThis.game.user = {};
  });

  it("только основной ГМ", async () => {
    const a = makeActor({ fatigue: 9, conditions: { unconscious: true, fatigueFaintWakeAt: 1000 } });
    Object.assign(globalThis.game, { actors: [a], users: { activeGM: { id: "gm1" } }, user: { id: "pl1" } });
    await sweepAllConditionClocks(1100, 200);
    expect(a.system.conditions.unconscious).toBe(true);

    globalThis.game.user = { id: "gm1" };
    await sweepAllConditionClocks(1100, 200);
    expect(a.system.conditions.unconscious).toBe(false);
  });
  // wdbc-t3c3t.11: несвязанный токен (статист) — синтетический актор, в
  // game.actors его нет; связанный токен уже пройден через game.actors.
  it("идёт и у несвязанных токенов сцен, связанные не дублируются", async () => {
    const world = makeActor({ fatigue: 9, conditions: { unconscious: true, fatigueFaintWakeAt: 1000 } });
    const extra = makeActor({ fatigue: 9, conditions: { unconscious: true, fatigueFaintWakeAt: 1000 } });
    const tokens = [
      { actorLink: true, actor: world },
      { actorLink: false, actor: extra },
      { actorLink: false, actor: null }
    ];
    Object.assign(globalThis.game, {
      actors: [world], scenes: [{ tokens: { contents: tokens } }],
      users: { activeGM: { id: "gm1" } }, user: { id: "gm1" }
    });
    await sweepAllConditionClocks(1100, 200);
    expect(world.system.conditions.unconscious).toBe(false);
    expect(extra.system.conditions.unconscious).toBe(false);
    expect(captured.chat.length).toBe(2);
  });

  // wdbc-t3c3t.13: авто-течение Календаря и ручной сдвиг параллельно — прогоны
  // идут по очереди, второй отрезок не теряется.
  it("два прогона подряд не перекрываются и идут по порядку", async () => {
    const log = [];
    const probe = { id: "probe", run: async (_a, { from, to }) => {
      log.push(`in ${from}-${to}`);
      await new Promise(r => setTimeout(r, 5));
      log.push(`out ${from}-${to}`);
    } };
    CONDITION_CLOCK_HANDLERS.push(probe);
    try {
      Object.assign(globalThis.game, { actors: [makeActor()], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });
      await Promise.all([sweepAllConditionClocks(1100, 100), sweepAllConditionClocks(1200, 100)]);
    } finally {
      CONDITION_CLOCK_HANDLERS.splice(CONDITION_CLOCK_HANDLERS.indexOf(probe), 1);
    }
    expect(log).toEqual(["in 1000-1100", "out 1000-1100", "in 1100-1200", "out 1100-1200"]);
  });
});
