// test/combat/recharge.test.mjs
//
// Перезарядка (wdbc-ai0o): «нельзя стрелять в следующий Ход» — needsRecharge
// остаётся true через ПЕРВЫЙ старт Хода носителя после выстрела (тот самый
// заблокированный Ход) и снимается только на ВТОРОМ.

import { describe, it, expect } from "vitest";
import { processRechargeTurnStart } from "../../module/combat/recharge.mjs";
import { weaponFor, actorFor } from "../support/combat-fixtures.mjs";

function rechargingWeapon({ id, ...overrides } = {}) {
  const w = weaponFor({ needsRecharge: true, rechargeTurnsRemaining: 1, ...overrides },
    id ? { id } : undefined);
  w.type = "weapon";
  return w;
}

describe("processRechargeTurnStart: needsRecharge снимается через один полный Ход", () => {
  it("сразу после выстрела (rechargeTurnsRemaining:1) — первый старт Хода ещё блокирует", async () => {
    const w = rechargingWeapon();
    const a = actorFor({ items: [w] });
    await processRechargeTurnStart(a);
    expect(w.system.needsRecharge).toBe(true);
    expect(w.system.rechargeTurnsRemaining).toBe(0);
  });

  it("второй старт Хода (rechargeTurnsRemaining уже 0) — снимает needsRecharge", async () => {
    const w = rechargingWeapon({ rechargeTurnsRemaining: 0 });
    const a = actorFor({ items: [w] });
    await processRechargeTurnStart(a);
    expect(w.system.needsRecharge).toBe(false);
  });

  it("оружие без needsRecharge — не трогается", async () => {
    const w = weaponFor({ needsRecharge: false, rechargeTurnsRemaining: 0 });
    w.type = "weapon";
    const a = actorFor({ items: [w] });
    await processRechargeTurnStart(a);
    expect(w.system.needsRecharge).toBe(false);
    expect(w.system.rechargeTurnsRemaining).toBe(0);
  });

  it("несколько единиц оружия на подзарядке — каждая считает своё", async () => {
    const w1 = rechargingWeapon({ id: "w1", rechargeTurnsRemaining: 1 });
    const w2 = rechargingWeapon({ id: "w2", rechargeTurnsRemaining: 0 });
    const a = actorFor({ items: [w1, w2] });
    await processRechargeTurnStart(a);
    expect(w1.system.needsRecharge).toBe(true);
    expect(w1.system.rechargeTurnsRemaining).toBe(0);
    expect(w2.system.needsRecharge).toBe(false);
  });
});
