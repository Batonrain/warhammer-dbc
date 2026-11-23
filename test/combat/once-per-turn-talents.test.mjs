// test/combat/once-per-turn-talents.test.mjs
// Ария (Воин Ноты) — «раз в Ход», Разбежаться! (Лидерство) — «в начале боя», один раз (приёмка #597).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { useAria } from "../../module/combat/battle-music.mjs";
import { useFanOut } from "../../module/combat/fan-out.mjs";
import { ariaUsedThisTurn, ariaTurnMark } from "../../module/rules/battle-music.mjs";

const NS = "warhammer-dbc";

function makeActor(items, flags = {}) {
  const actor = {
    uuid: "Actor.n", name: "Нота", items, flags: { [NS]: { ...flags } },
    system: { characteristics: { ag: { total: 50 } } },
    getFlag: (_s, k) => actor.flags[NS][k],
    setFlag: async (_s, k, v) => { actor.flags[NS][k] = v; }
  };
  return actor;
}

beforeEach(resetCaptured);
afterEach(() => { delete globalThis.game.combat; });

describe("Ария — раз в Ход", () => {
  const blade = { type: "weapon", name: "Клинок", system: { equipped: true, weaponClass: "melee", meleeCategory: "Меч", balance: 0 } };

  it("второй тест в тот же Ход — отказ, в следующий Ход — можно", async () => {
    globalThis.game.combat = { id: "c1", started: true, round: 2, turn: 1 };
    const actor = makeActor([{ type: "talent", name: "Aria / Ария" }, blade]);
    await useAria(actor);
    expect(captured.rolls.length).toBe(1);
    await useAria(actor);
    expect(captured.rolls.length).toBe(1);
    expect(captured.warnings.join("\n")).toContain("раз в Ход");
    globalThis.game.combat.turn = 2;
    await useAria(actor);
    expect(captured.rolls.length).toBe(2);
  });

  it("метка чужого боя не мешает; вне боя ограничения нет", () => {
    const a = { flags: { [NS]: { ariaTurn: ariaTurnMark({ id: "c1", round: 1, turn: 0 }) } } };
    expect(ariaUsedThisTurn(a, { id: "c1", round: 1, turn: 0 })).toBe(true);
    expect(ariaUsedThisTurn(a, { id: "c2", round: 1, turn: 0 })).toBe(false);
    expect(ariaUsedThisTurn(a, null)).toBe(false);
  });
});

describe("Разбежаться! — раз за бой", () => {
  it("повторная кнопка в том же бою не бросает тест", async () => {
    globalThis.game.combat = { id: "c1", started: true, round: 1 };
    const actor = makeActor([{ type: "talent", name: "Fan Out! / Разбежаться!" }], { fanOutUsed: "c1" });
    await useFanOut(actor);
    expect(captured.rolls.length).toBe(0);
    expect(captured.warnings.join("\n")).toContain("раз за бой");
  });
});
