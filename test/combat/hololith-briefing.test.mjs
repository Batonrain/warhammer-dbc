// test/combat/hololith-briefing.test.mjs
//
// Гололит (стр. 256): «Брифинг: Tech-Use+0 + час подготовки → +10 Command».
// wdbc-x1nz.2 — раньше бонус капал просто по факту владения; теперь тест
// Tech-Use+0 ставит флаг, который читает rules/situational.mjs и гасит
// actor-sheet.mjs после теста Command.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { hasHololithBriefing, clearHololithBriefing, useHololithBriefing }
  from "../../module/combat/hololith-briefing.mjs";

function actor({ techUse = 40, briefed } = {}) {
  const flags = {};
  if (briefed !== undefined) flags.hololithBriefed = briefed;
  return {
    id: "a1", name: "Гвардеец",
    system: { skills: { techUse: { total: techUse } } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
});

describe("hasHololithBriefing / clearHololithBriefing", () => {
  it("флага нет — false, clear ничего не делает (не падает)", async () => {
    const a = actor();
    expect(hasHololithBriefing(a)).toBe(false);
    await clearHololithBriefing(a);
    expect(hasHololithBriefing(a)).toBe(false);
  });

  it("флаг стоит — true, clear снимает", async () => {
    const a = actor({ briefed: true });
    expect(hasHololithBriefing(a)).toBe(true);
    await clearHololithBriefing(a);
    expect(hasHololithBriefing(a)).toBe(false);
  });
});

describe("useHololithBriefing", () => {
  const item = { id: "holo1", name: "Hololith / Гололит" };

  it("успех — ставит флаг подготовки", async () => {
    captured.nextRoll = 10; // Tech-Use 40 → успех
    const a = actor({ techUse: 40 });

    await useHololithBriefing(a, item);

    expect(hasHololithBriefing(a)).toBe(true);
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Успех");
  });

  it("провал — флаг не ставится", async () => {
    captured.nextRoll = 90; // Tech-Use 40 → провал
    const a = actor({ techUse: 40 });

    await useHololithBriefing(a, item);

    expect(hasHololithBriefing(a)).toBe(false);
    expect(captured.chat[0].content).toContain("Провал");
  });
});
