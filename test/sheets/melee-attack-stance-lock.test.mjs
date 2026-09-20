// test/sheets/melee-attack-stance-lock.test.mjs
//
// Стр. 31, wdbc-x1nz.2.64: «Смена Стойки и Хвата... Это действие нельзя
// проводить после рукопашной атаки.» Хват отдельным действием в системе не
// существует (выбирается заново при каждой атаке) — блокируется только
// Стойка, тем же флагом attackedThisTurn, что уже читает Кровопомазанник
// (module/combat/turn-state-shield.mjs) для обратного вопроса.

import { describe, it, expect } from "vitest";
import { sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { characterContext } from "../../module/sheets/character-context.mjs";

async function ctxWithTurnFlag({ items = [], attackedIds = [] } = {}) {
  const sheet = sheetOf(WarhammerCharacterSheet, { items, characteristics: {}, skills: {}, groupSkills: {} });
  sheet.actor.items.contents = sheet.actor.items;
  if (attackedIds.length) await sheet.actor.setFlag("warhammer-dbc", "attackedThisTurn", attackedIds);
  return characterContext(sheet.actor);
}

describe("Стойка: заблокирована после рукопашной атаки в этом Ходу (wdbc-x1nz.2.64)", () => {
  it("рукопашным оружием атаковали в этом Ходу — stanceLocked: true", async () => {
    const sword = { id: "w1", type: "weapon", system: { weaponClass: "melee" }, getFlag: () => undefined };
    const ctx = await ctxWithTurnFlag({ items: [sword], attackedIds: ["w1"] });
    expect(ctx.stanceLocked).toBe(true);
  });

  it("стреляли (не рукопашным) в этом Ходу — Стойка не блокируется", async () => {
    const rifle = { id: "w1", type: "weapon", system: { weaponClass: "basic" }, getFlag: () => undefined };
    const ctx = await ctxWithTurnFlag({ items: [rifle], attackedIds: ["w1"] });
    expect(ctx.stanceLocked).toBe(false);
  });

  it("ещё не атаковали в этом Ходу — не заблокирована", async () => {
    const sword = { id: "w1", type: "weapon", system: { weaponClass: "melee" }, getFlag: () => undefined };
    const ctx = await ctxWithTurnFlag({ items: [sword], attackedIds: [] });
    expect(ctx.stanceLocked).toBe(false);
  });
});
