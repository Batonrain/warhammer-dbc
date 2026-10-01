// test/combat/explosive-action.test.mjs
//
// wdbc-tkeh1. Взрывное Действие (Сплайс): раз в Ход бонусное полудействие, не
// на Ментальные действия; в конце Хода — 1 Усталости и 1d5 урона в S, T, A.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useExplosiveAction, applyExplosiveActionTurnEnd } from "../../module/combat/explosive-action.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const flags = {};
function splice(extra = {}) {
  const actor = {
    id: "a1", uuid: "Actor.a1", name: "Сплайс", type: "character", items: [],
    system: { actionPoints: { value: 1, max: 2 }, fatigue: { value: 0 }, characteristics: { t: { total: 40, bonus: 4 }, s: { total: 40 }, ag: { total: 40 } },
      charLoss: {}, charLossAt: {}, conditions: {} },
    updates: [],
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; }, unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async function (d) { this.updates.push(d); },
    ...extra
  };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  for (const k of Object.keys(flags)) delete flags[k];
});
afterEach(() => { globalThis.game.combat = null; });

describe("данные пака", () => {
  it("Адаптация несёт кнопку useExplosiveAction", () => {
    const doc = packDocById("packs-src/traits/Трейты_рас/Адаптации_Сплайса", "85gatRcVdjvbOqmO");
    const codes = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "script").map(e => e.code);
    expect(codes.some(c => c.includes("useExplosiveAction(actor)"))).toBe(true);
  });
});

describe("useExplosiveAction", () => {
  it("вне боя или не в свой Ход — отказ, ОД не меняются", async () => {
    const a = splice();
    await useExplosiveAction(a);
    expect(a.updates).toHaveLength(0);
    expect(captured.warnings.at(-1)).toMatch(/Взрывное Действие/);
  });

  it("в свой Ход: +1 ОД и отметка; второй раз за Ход — нельзя", async () => {
    const a = splice();
    globalThis.game.combat = { id: "c1", round: 2, started: true, combatant: { actor: a, actorId: a.id } };
    await useExplosiveAction(a);
    expect(a.updates.at(-1)).toEqual({ "system.actionPoints.value": 2 });
    expect(flags.explosiveAction).toEqual({ combatId: "c1", round: 2 });
    a.updates.length = 0;
    await useExplosiveAction(a);
    expect(a.updates).toHaveLength(0);
    // Новый Ход — снова можно.
    globalThis.game.combat.round = 3;
    await useExplosiveAction(a);
    expect(a.updates.at(-1)).toEqual({ "system.actionPoints.value": 2 });
  });
});

describe("applyExplosiveActionTurnEnd", () => {
  it("без отметки — ничего", async () => {
    const a = splice();
    globalThis.game.combat = { id: "c1", round: 2 };
    await applyExplosiveActionTurnEnd(a);
    expect(a.updates).toHaveLength(0);
    expect(captured.chat).toHaveLength(0);
  });

  it("с отметкой: отметка снята, карточка с расплатой в S, T, A", async () => {
    const a = splice();
    flags.explosiveAction = { combatId: "c1", round: 2 };
    globalThis.game.combat = { id: "c1", round: 2 };
    captured.dice = [3];
    await applyExplosiveActionTurnEnd(a);
    expect(flags.explosiveAction).toBeUndefined();
    const html = captured.chat.at(-1).content;
    expect(html).toContain("расплата");
    expect(html).toContain("<b>3</b>");
  });

  it("отметка от прежнего боя — только гасится", async () => {
    const a = splice();
    flags.explosiveAction = { combatId: "old", round: 9 };
    globalThis.game.combat = { id: "c2", round: 1 };
    await applyExplosiveActionTurnEnd(a);
    expect(flags.explosiveAction).toBeUndefined();
    expect(captured.chat).toHaveLength(0);
  });
});
