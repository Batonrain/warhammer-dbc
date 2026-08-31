// test/combat/disabled-armour-periodic-test.test.mjs
//
// «Раз в T.b часов перевеса тест T+0 или 1 Усталость» (стр. 233,
// «Выключенная Силовая Броня») — часть 4 wdbc-rdd. Таймер по game.time.
// worldTime, тем же приёмом, что Сус-ан Мембрана (apps/sus-an-heal.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  disabledArmourPeriodicTestRemaining,
  syncDisabledArmourOverloadTimer,
  useDisabledArmourPeriodicTest
} from "../../module/combat/armor-mods.mjs";

const FLAG = "warhammer-dbc";
const OVERLOAD_TEST_AT_FLAG = "disabledArmourOverloadTestAt";
const MAX_AGILITY_FORCED_FLAG = "disabledArmourMaxAgilityForced10";

function actorWith({ t = 40, tb = 4, wb = 3, overload = null, testAt, maxAgilityForced } = {}) {
  const flags = {};
  if (testAt !== undefined) flags[OVERLOAD_TEST_AT_FLAG] = testAt;
  if (maxAgilityForced !== undefined) flags[MAX_AGILITY_FORCED_FLAG] = maxAgilityForced;
  const actor = {
    id: "actor-1", name: "Тестовый Астартес",
    system: {
      characteristics: { t: { total: t, bonus: tb }, wp: { bonus: wb } },
      fatigue: { value: 0, max: 0 },
      disabledArmourOverload: overload
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async data => {
      captured.updates.push(data);
      if ("system.fatigue.value" in data) actor.system.fatigue.value = data["system.fatigue.value"];
      if ("system.fatigue.max" in data) actor.system.fatigue.max = data["system.fatigue.max"];
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
  globalThis.game.user = { isGM: true };
});

describe("disabledArmourPeriodicTestRemaining", () => {
  it("флага (testAt) нет — доступно сейчас", () => {
    expect(disabledArmourPeriodicTestRemaining(null, 100000, 4)).toBe(0);
  });

  it("tb=0 — интервал делить не на что, кнопка всегда доступна (0, не NaN/Infinity)", () => {
    expect(disabledArmourPeriodicTestRemaining(100000, 200000, 0)).toBe(0);
  });

  it("началось только что — в запасе полный интервал tb часов", () => {
    expect(disabledArmourPeriodicTestRemaining(100000, 100000, 4)).toBe(4 * 3600);
  });

  it("прошло меньше интервала — остаток посчитан верно", () => {
    // tb=4 → интервал 14400с; testAt=100000, worldTime=100000+2*3600 → осталось 2ч.
    expect(disabledArmourPeriodicTestRemaining(100000, 100000 + 2 * 3600, 4)).toBe(2 * 3600);
  });

  it("интервал прошёл полностью — 0 (тест доступен)", () => {
    expect(disabledArmourPeriodicTestRemaining(100000, 100000 + 4 * 3600, 4)).toBe(0);
  });

  it("интервал прошёл с запасом — тоже 0, не отрицательное число", () => {
    expect(disabledArmourPeriodicTestRemaining(100000, 100000 + 10 * 3600, 4)).toBe(0);
  });
});

describe("syncDisabledArmourOverloadTimer", () => {
  it("перевес появился, флага не было — ставит текущий worldTime", async () => {
    const actor = actorWith({ overload: { tier: 1 } });
    await syncDisabledArmourOverloadTimer(actor);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBe(100000);
  });

  it("перевес есть, флаг уже стоял — не перезаписывает (не сбрасывает уже идущий отсчёт)", async () => {
    const actor = actorWith({ overload: { tier: 2 }, testAt: 50000 });
    await syncDisabledArmourOverloadTimer(actor);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBe(50000);
  });

  it("перевес кончился, флаг был — снимает его", async () => {
    const actor = actorWith({ overload: null, testAt: 50000 });
    await syncDisabledArmourOverloadTimer(actor);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBeUndefined();
  });

  it("перевеса нет и флага не было — ничего не делает", async () => {
    const actor = actorWith({ overload: null });
    await syncDisabledArmourOverloadTimer(actor);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBeUndefined();
  });

  it("не ГМ — не пишет флаг, даже если перевес появился", async () => {
    globalThis.game.user = { isGM: false };
    const actor = actorWith({ overload: { tier: 1 } });
    await syncDisabledArmourOverloadTimer(actor);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBeUndefined();
  });

  it("перевес кончился — снимает и disabledArmourMaxAgilityForced10 (провал теста-развилки не переживает конец перевеса)", async () => {
    const actor = actorWith({ overload: null, testAt: 50000, maxAgilityForced: true });
    await syncDisabledArmourOverloadTimer(actor);
    expect(actor.getFlag(FLAG, MAX_AGILITY_FORCED_FLAG)).toBeUndefined();
  });

  it("перевес ещё идёт — не трогает disabledArmourMaxAgilityForced10", async () => {
    const actor = actorWith({ overload: { tier: 1 }, testAt: 50000, maxAgilityForced: true });
    await syncDisabledArmourOverloadTimer(actor);
    expect(actor.getFlag(FLAG, MAX_AGILITY_FORCED_FLAG)).toBe(true);
  });
});

describe("useDisabledArmourPeriodicTest", () => {
  it("интервал ещё не истёк — предупреждает и не бросает кубы", async () => {
    const actor = actorWith({ tb: 4, testAt: 100000 }); // весь интервал впереди
    await useDisabledArmourPeriodicTest(actor);
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBe(100000); // таймер не тронут
  });

  it("успех — Усталость не растёт, таймер сбрасывается на текущий worldTime", async () => {
    captured.nextRoll = 10; // T 40 → успех
    const actor = actorWith({ t: 40, tb: 4, testAt: 100000 - 5 * 3600 }); // интервал прошёл
    await useDisabledArmourPeriodicTest(actor);
    expect(actor.system.fatigue.value).toBe(0);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBe(100000);
    expect(captured.chat.length).toBe(1);
  });

  it("провал — +1 Усталость, таймер тоже сбрасывается (не только по успеху)", async () => {
    captured.nextRoll = 99; // выше T 40 — провал
    const actor = actorWith({ t: 40, tb: 4, testAt: 100000 - 5 * 3600 });
    await useDisabledArmourPeriodicTest(actor);
    expect(actor.system.fatigue.value).toBe(1);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBe(100000);
    expect(captured.chat.length).toBe(1);
  });

  it("флага не было вовсе (interval=0 по определению remaining) — тест проводится сразу", async () => {
    captured.nextRoll = 10;
    const actor = actorWith({ t: 40, tb: 4 }); // testAt отсутствует
    await useDisabledArmourPeriodicTest(actor);
    expect(captured.warnings.length).toBe(0);
    expect(actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG)).toBe(100000);
  });
});
