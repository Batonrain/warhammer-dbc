// test/combat/attack-grenade-melee-consumption.test.mjs
//
// Стр. 40, wdbc-x1nz.2.60: «Если промазала, граната не тратится» — обратное
// для попадания: успешный рукопашный «укол» гранатой расходует её как
// одноразовый предмет (Количество −1, либо удаление предмета).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

function grenade(overrides = {}) {
  const weapon = weaponFor({
    weaponType: "grenade", weaponClass: "thrown", damage: "2d10", rof_single: 1, quantity: 3,
    ...overrides
  }, { id: "w1" });
  weapon.update = async (data) => { weapon.system.quantity = data["system.quantity"]; };
  weapon.delete = async () => { weapon.deleted = true; };
  return weapon;
}

describe("Граната в рукопашной: расход при попадании, не при промахе (wdbc-x1nz.2.60)", () => {
  it("попадание в рукопашной — Количество уменьшается на 1", async () => {
    const weapon = grenade();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5]; // rv=10 — попадание против Порога 45

    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, { forceMelee: true });

    expect(weapon.system.quantity).toBe(2);
    expect(weapon.deleted).toBeFalsy();
  });

  it("попадание в рукопашной, последняя граната (quantity=1) — предмет удаляется", async () => {
    const weapon = grenade({ quantity: 1 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, { forceMelee: true });

    expect(weapon.deleted).toBe(true);
  });

  it("промах в рукопашной — граната НЕ тратится", async () => {
    const weapon = grenade();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [90]; // промах против Порога 45

    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, { forceMelee: true });

    expect(weapon.system.quantity).toBe(3);
    expect(weapon.deleted).toBeFalsy();
  });

  it("переброс того же попадания (skipAmmo) — не тратится повторно", async () => {
    const weapon = grenade();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, { forceMelee: true, skipAmmo: true });

    expect(weapon.system.quantity).toBe(3);
  });
});
