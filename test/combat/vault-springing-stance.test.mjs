// test/combat/vault-springing-stance.test.mjs
//
// Пружинящая Стойка (стр. 15, wdbc-x1nz.2.66.8): «SPD+2 для Отскока» —
// halfMove уже несёт книжный SPD−2 движения (module/rules/character/
// movement.mjs, применяется к ЛЮБОМУ движению), Вольт (Отскок) вместо этого
// хочет SPD+2 — то есть +4 к уже посчитанному halfMove.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { vaultHalfMove } from "../../module/combat/movement-actions.mjs";

function actorWith(stance, halfMove) {
  return { system: { meleeStance: stance, movement: { halfMove } } };
}

// Сама прибавка +4 в Пружинящей Стойке — test/combat/speed-consumers-multipliers.test.mjs.
describe("vaultHalfMove", () => {
  it("другая Стойка — halfMove не меняется", () => {
    expect(vaultHalfMove(actorWith("standard", 4))).toBe(4);
    expect(vaultHalfMove(actorWith("aggressive", 4))).toBe(4);
  });

  it("нет Стойки вовсе (undefined) — halfMove не меняется", () => {
    expect(vaultHalfMove({ system: { movement: { halfMove: 3 } } })).toBe(3);
  });
});
