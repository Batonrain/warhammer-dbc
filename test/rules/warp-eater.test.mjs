// test/rules/warp-eater.test.mjs
//
// Пожиратель Варпа / Warp Eater (Общая мутация, wdbc-1rno): раз в месяц
// тест Cor+10 или 1 Порчи, избегается 4 «насыщениями» за месяц.

import "../support/foundry-stub.mjs";
import { captured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  monthOf, feedCountForMonth, processWarpEaterMonthCheck, WARP_EATER_FLAG, WARP_EATER_FEED_KEY
} from "../../module/rules/warp-eater.mjs";
import { incrementThrottleCount } from "../../module/rules/cooldown.mjs";

const SECONDS_PER_MONTH = 30 * 86400;

function mockActor({ hasGift = true, corruption = 10 } = {}) {
  const flags = { "warhammer-dbc": {} };
  const items = hasGift ? [{
    id: "gift", type: "mutation", name: "Warp Eater",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: WARP_EATER_FLAG, label: "" }
    ] }] } }
  }] : [];
  const system = { corruption: { value: corruption } };
  return {
    name: "Пожиратель",
    system,
    flags,
    items: Object.assign(items.slice(), { contents: items }),
    getFlag: (sc, k) => flags[sc]?.[k],
    setFlag: async (sc, k, v) => { (flags[sc] ??= {})[k] = v; },
    unsetFlag: async (sc, k) => { delete flags[sc]?.[k]; },
    update: async data => {
      if ("system.corruption.value" in data) system.corruption.value = data["system.corruption.value"];
    }
  };
}

// incrementThrottleCount (rules/cooldown.mjs) читает game.time.worldTime
// напрямую, а не параметр worldTime, что передаётся сюда — в реальном
// Foundry это одно и то же значение (оба читаются из живого game.time в
// момент вызова), но в заглушке своего game.time нет вовсе (Number(undefined)
// || 0 = 0 всегда). Тесты, что кормят ДО смены месяца, обязаны сами выставить
// game.time.worldTime на момент кормления — иначе счётчик молча ляжет в
// «месяц 0» независимо от того, какой worldTime передан processWarpEater…
function feedAt(actor, worldTime) {
  const prev = globalThis.game.time;
  globalThis.game.time = { worldTime };
  const p = incrementThrottleCount(actor, WARP_EATER_FEED_KEY, "month", 4);
  return p.finally(() => { globalThis.game.time = prev; });
}

beforeEach(() => { captured.nextRoll = 50; captured.dice = null; captured.chat.length = 0; });

describe("monthOf", () => {
  it("считает 30-суточные месяцы от эпохи worldTime=0", () => {
    expect(monthOf(0)).toBe(0);
    expect(monthOf(SECONDS_PER_MONTH - 1)).toBe(0);
    expect(monthOf(SECONDS_PER_MONTH)).toBe(1);
    expect(monthOf(SECONDS_PER_MONTH * 5)).toBe(5);
  });
});

describe("feedCountForMonth", () => {
  it("нет насыщений вовсе — 0", () => {
    const actor = mockActor();
    expect(feedCountForMonth(actor, 3)).toBe(0);
  });

  it("счётчик другого месяца не засчитывается", async () => {
    const actor = mockActor();
    await incrementThrottleCount(actor, WARP_EATER_FEED_KEY, "month", 4);
    // incrementThrottleCount пишет ТЕКУЩИЙ (game.time.worldTime=0 в стенде) месяц — 0.
    expect(feedCountForMonth(actor, 1)).toBe(0);
    expect(feedCountForMonth(actor, 0)).toBe(1);
  });
});

describe("processWarpEaterMonthCheck", () => {
  it("нет Мутации у актора — ничего не делает", async () => {
    const actor = mockActor({ hasGift: false });
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 3);
    expect(actor.getFlag("warhammer-dbc", "warpEaterLastMonth")).toBeUndefined();
    expect(actor.system.corruption.value).toBe(10);
  });

  it("первый вызов — инициализирует базовую линию БЕЗ теста (не наказывает за прошлое)", async () => {
    const actor = mockActor({ corruption: 10 });
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 5);
    expect(actor.getFlag("warhammer-dbc", "warpEaterLastMonth")).toBe(5);
    expect(actor.system.corruption.value).toBe(10);
    expect(captured.chat.length).toBe(0);
  });

  it("тот же месяц, что и в прошлый раз — ничего не делает", async () => {
    const actor = mockActor();
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 5);
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 5 + 100);
    expect(actor.getFlag("warhammer-dbc", "warpEaterLastMonth")).toBe(5);
    expect(captured.chat.length).toBe(0);
  });

  it("месяц закончился, насыщений было 4+ — Порчи нет", async () => {
    const actor = mockActor({ corruption: 10 });
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 5); // база = месяц 5
    for (let i = 0; i < 4; i++) await feedAt(actor, SECONDS_PER_MONTH * 5);
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 6); // месяц 5 закончился
    expect(actor.system.corruption.value).toBe(10);
    expect(actor.getFlag("warhammer-dbc", "warpEaterLastMonth")).toBe(6);
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Порча не грозит");
  });

  it("месяц закончился, насыщений <4, провал теста Cor+10 — +1 Порчи", async () => {
    const actor = mockActor({ corruption: 10 });
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 5);
    await feedAt(actor, SECONDS_PER_MONTH * 5); // 1 из 4
    captured.nextRoll = 99; // порог 10+10=20, 99 > 20 — провал
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 6);
    expect(actor.system.corruption.value).toBe(11);
    expect(captured.chat[0].content).toContain("провал");
  });

  it("месяц закончился, насыщений <4, успех теста Cor+10 — Порчи нет", async () => {
    const actor = mockActor({ corruption: 10 });
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 5);
    captured.nextRoll = 5; // порог 20, 5 <= 20 — успех
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 6);
    expect(actor.system.corruption.value).toBe(10);
    expect(captured.chat[0].content).toContain("успех");
  });

  it("МУТАЦИЯ: без насыщений засчитанный порог считался бы неверно (регресс-ловушка)", async () => {
    // Проверяет, что порог реально Cor+10, а не Cor или Cor+20 — если формулу
    // сломать на +20, этот тест поймает (99 <= 30, был бы «успех», а не «провал»).
    const actor = mockActor({ corruption: 10 });
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 5);
    captured.nextRoll = 25; // между Cor+10=20 (провал) и Cor+20=30 (был бы успех)
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 6);
    expect(actor.system.corruption.value).toBe(11);
  });

  it("несколько месяцев прошло разом — каждый проверяется отдельно", async () => {
    const actor = mockActor({ corruption: 10 });
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 5); // база = 5
    captured.nextRoll = 99; // оба месяца проваливают тест
    await processWarpEaterMonthCheck(actor, SECONDS_PER_MONTH * 7); // месяцы 5 и 6 закончились
    expect(actor.system.corruption.value).toBe(12); // +1 за месяц 5, +1 за месяц 6
    expect(actor.getFlag("warhammer-dbc", "warpEaterLastMonth")).toBe(7);
  });
});
