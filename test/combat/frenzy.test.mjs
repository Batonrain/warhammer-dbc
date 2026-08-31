// test/combat/frenzy.test.mjs
//
// module/combat/frenzy.mjs (wdbc-sk8s) — Frenzy/Ярость: «однажды выйдя,
// нельзя войти снова до конца боя», снимается Чертой Butcher's Nails/
// Гвозди Мясника. Сам тумблер system.inRage (UI-интеграция в
// module/sheets/tabs/combat.mjs) не тестируется отдельно — только примитив.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { frenzyEntryBlocked, markFrenzyExited, hasButchersNails } from "../../module/combat/frenzy.mjs";

function actor({ hasFrenzy = true, hasNails = false } = {}) {
  const flags = {};
  const items = [];
  if (hasFrenzy) items.push({ type: "talent", name: "Frenzy / Ярость" });
  if (hasNails) items.push({ type: "trait", name: "Butcher's Nails / Гвозди Мясника" });
  return {
    items,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("hasButchersNails", () => {
  it("определяет владение Чертой", () => {
    expect(hasButchersNails(actor({ hasNails: true }))).toBe(true);
    expect(hasButchersNails(actor({ hasNails: false }))).toBe(false);
  });
});

describe("frenzyEntryBlocked / markFrenzyExited", () => {
  it("без Таланта Frenzy — вход никогда не блокируется (лимит только для его владельцев)", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = actor({ hasFrenzy: false });
    await markFrenzyExited(a);
    expect(frenzyEntryBlocked(a)).toBe(false);
  });

  it("первый вход/выход — второй вход в том же бою заблокирован", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = actor();
    expect(frenzyEntryBlocked(a)).toBe(false); // ещё не выходил
    await markFrenzyExited(a);
    expect(frenzyEntryBlocked(a)).toBe(true);
  });

  it("новый бой — лимит снят", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = actor();
    await markFrenzyExited(a);
    expect(frenzyEntryBlocked(a)).toBe(true);
    globalThis.game.combat = { id: "combat-2" };
    expect(frenzyEntryBlocked(a)).toBe(false);
  });

  it("Butcher's Nails — лимит не действует вовсе, markFrenzyExited не пишет флаг", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = actor({ hasNails: true });
    await markFrenzyExited(a);
    expect(frenzyEntryBlocked(a)).toBe(false);
  });
});
