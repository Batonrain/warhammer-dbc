// test/combat/inventory-overload-periodic-test.test.mjs
//
// «Раз в T.b часов Перевеса тест T+0, накапливая −10 за каждый тест после
// первого, или 1 Усталости» (стр. 27, «Максимальный Вес») — wdbc-x1nz.2.
// Таймер по game.time.worldTime, тем же приёмом, что Перевес выключенной
// силовой брони (combat/armor-mods.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  inventoryOverloadPeriodicRemaining,
  syncInventoryOverloadTimer,
  useInventoryOverloadPeriodicTest
} from "../../module/combat/encumbrance.mjs";

const FLAG = "warhammer-dbc";
const TEST_AT_FLAG = "inventoryOverloadTestAt";
const TEST_COUNT_FLAG = "inventoryOverloadTestCount";

function actorWith({ t = 40, tb = 4, carry = 20, current = 0, testAt, count } = {}) {
  const flags = {};
  if (testAt !== undefined) flags[TEST_AT_FLAG] = testAt;
  if (count !== undefined) flags[TEST_COUNT_FLAG] = count;
  const actor = {
    id: "actor-1", name: "Тестовый Гвардеец",
    system: {
      characteristics: { t: { total: t, bonus: tb } },
      fatigue: { value: 0, max: 0 },
      encumbrance: { carry, effectiveCurrent: current }
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async data => {
      captured.updates.push(data);
      if ("system.fatigue.value" in data) actor.system.fatigue.value = data["system.fatigue.value"];
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

describe("inventoryOverloadPeriodicRemaining", () => {
  it("флага (testAt) нет — доступно сейчас", () => {
    expect(inventoryOverloadPeriodicRemaining(null, 100000, 4)).toBe(0);
  });

  it("tb=0 — интервал делить не на что, кнопка всегда доступна", () => {
    expect(inventoryOverloadPeriodicRemaining(100000, 200000, 0)).toBe(0);
  });

  it("прошло меньше интервала — остаток посчитан верно", () => {
    expect(inventoryOverloadPeriodicRemaining(100000, 100000 + 2 * 3600, 4)).toBe(2 * 3600);
  });

  it("интервал прошёл полностью — 0 (тест доступен)", () => {
    expect(inventoryOverloadPeriodicRemaining(100000, 100000 + 4 * 3600, 4)).toBe(0);
  });
});

describe("syncInventoryOverloadTimer", () => {
  it("перевес появился, флага не было — ставит текущий worldTime", async () => {
    const actor = actorWith({ carry: 20, current: 25 }); // over carry
    await syncInventoryOverloadTimer(actor);
    expect(actor.getFlag(FLAG, TEST_AT_FLAG)).toBe(100000);
  });

  it("перевес есть, флаг уже стоял — не перезаписывает", async () => {
    const actor = actorWith({ carry: 20, current: 25, testAt: 50000 });
    await syncInventoryOverloadTimer(actor);
    expect(actor.getFlag(FLAG, TEST_AT_FLAG)).toBe(50000);
  });

  it("перевес кончился — снимает флаг и счётчик тестов", async () => {
    const actor = actorWith({ carry: 20, current: 5, testAt: 50000, count: 3 });
    await syncInventoryOverloadTimer(actor);
    expect(actor.getFlag(FLAG, TEST_AT_FLAG)).toBeUndefined();
    expect(actor.getFlag(FLAG, TEST_COUNT_FLAG)).toBeUndefined();
  });

  it("перевеса нет и флага не было — ничего не делает", async () => {
    const actor = actorWith({ carry: 20, current: 5 });
    await syncInventoryOverloadTimer(actor);
    expect(captured.updates.length).toBe(0);
  });

  it("не ГМ — не пишет флаг, даже если перевес появился", async () => {
    globalThis.game.user = { isGM: false };
    const actor = actorWith({ carry: 20, current: 25 });
    await syncInventoryOverloadTimer(actor);
    expect(actor.getFlag(FLAG, TEST_AT_FLAG)).toBeUndefined();
  });
});

describe("useInventoryOverloadPeriodicTest", () => {
  it("перевеса нет вовсе — ничего не делает", async () => {
    const actor = actorWith({ carry: 20, current: 5, testAt: 100000 - 5 * 3600 });
    await useInventoryOverloadPeriodicTest(actor);
    expect(captured.chat.length).toBe(0);
    expect(captured.warnings.length).toBe(0);
  });

  it("интервал ещё не истёк — предупреждает и не бросает кубы", async () => {
    const actor = actorWith({ carry: 20, current: 25, tb: 4, testAt: 100000 });
    await useInventoryOverloadPeriodicTest(actor);
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("1-й тест захода — без накопленного штрафа (T+0), успех не двигает Усталость", async () => {
    captured.nextRoll = 10; // T 40 → успех
    const actor = actorWith({ carry: 20, current: 25, t: 40, tb: 4, testAt: 100000 - 5 * 3600 });
    await useInventoryOverloadPeriodicTest(actor);
    expect(actor.system.fatigue.value).toBe(0);
    expect(actor.getFlag(FLAG, TEST_AT_FLAG)).toBe(100000);
    expect(actor.getFlag(FLAG, TEST_COUNT_FLAG)).toBe(1);
    expect(captured.chat.length).toBe(1);
  });

  it("провал — +1 Усталость, таймер и счётчик тоже обновляются", async () => {
    captured.nextRoll = 99; // выше T 40 — провал
    const actor = actorWith({ carry: 20, current: 25, t: 40, tb: 4, testAt: 100000 - 5 * 3600 });
    await useInventoryOverloadPeriodicTest(actor);
    expect(actor.system.fatigue.value).toBe(1);
    expect(actor.getFlag(FLAG, TEST_COUNT_FLAG)).toBe(1);
  });

  it("3-й тест захода — накопленный штраф −20 к порогу (T 40 → 20), roll 25 проваливается", async () => {
    captured.nextRoll = 25; // между 20 (порог с накоплением) и 40 (голый T)
    const actor = actorWith({ carry: 20, current: 25, t: 40, tb: 4, testAt: 100000 - 5 * 3600, count: 2 });
    await useInventoryOverloadPeriodicTest(actor);
    expect(actor.system.fatigue.value).toBe(1); // 25 > 20 — провал именно из-за накопления
    expect(actor.getFlag(FLAG, TEST_COUNT_FLAG)).toBe(3);
  });

  it("тот же 3-й тест без накопления был бы успехом — подтверждает, что штраф действительно применён", async () => {
    captured.nextRoll = 25;
    const actor = actorWith({ carry: 20, current: 25, t: 40, tb: 4, testAt: 100000 - 5 * 3600, count: 0 });
    await useInventoryOverloadPeriodicTest(actor);
    expect(actor.system.fatigue.value).toBe(0); // 25 <= 40 — успех
  });
});
