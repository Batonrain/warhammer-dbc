// test/rules/hidden-threat.test.mjs
//
// wdbc-1rno.1: флаг «следующая атака этого актора — Незримая» —
// isHiddenThreatPending/markHiddenThreatPending/consumeHiddenThreatPending.
// Фейковый актор с минимальным getFlag/setFlag/unsetFlag, без foundry-stub.

import { describe, it, expect } from "vitest";
import { isHiddenThreatPending, markHiddenThreatPending, consumeHiddenThreatPending }
  from "../../module/rules/hidden-threat.mjs";

function fakeActor() {
  const flags = {};
  return {
    getFlag: (ns, key) => flags[key],
    setFlag: async (ns, key, value) => { flags[key] = value; },
    unsetFlag: async (ns, key) => { delete flags[key]; },
    _flags: flags
  };
}

describe("isHiddenThreatPending", () => {
  it("без пометки — false", () => {
    expect(isHiddenThreatPending(fakeActor())).toBe(false);
  });

  it("null/undefined актор — false, не бросает", () => {
    expect(isHiddenThreatPending(null)).toBe(false);
    expect(isHiddenThreatPending(undefined)).toBe(false);
  });
});

describe("markHiddenThreatPending / consumeHiddenThreatPending", () => {
  it("после markHiddenThreatPending — isHiddenThreatPending true", async () => {
    const actor = fakeActor();
    await markHiddenThreatPending(actor);
    expect(isHiddenThreatPending(actor)).toBe(true);
  });

  it("consumeHiddenThreatPending снимает пометку и возвращает true", async () => {
    const actor = fakeActor();
    await markHiddenThreatPending(actor);
    const consumed = await consumeHiddenThreatPending(actor);
    expect(consumed).toBe(true);
    expect(isHiddenThreatPending(actor)).toBe(false);
  });

  it("consumeHiddenThreatPending без пометки — возвращает false, ничего не трогает", async () => {
    const actor = fakeActor();
    const consumed = await consumeHiddenThreatPending(actor);
    expect(consumed).toBe(false);
    expect(isHiddenThreatPending(actor)).toBe(false);
  });

  it("consumeHiddenThreatPending дважды подряд — второй раз false (одноразовая пометка)", async () => {
    const actor = fakeActor();
    await markHiddenThreatPending(actor);
    expect(await consumeHiddenThreatPending(actor)).toBe(true);
    expect(await consumeHiddenThreatPending(actor)).toBe(false);
  });
});
