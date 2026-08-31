// test/rules/vehicle-spd-damage-reduce.test.mjs
//
// wdbc-07a6: «Многоногая / Multi-Legged (X)» должна снижать урон Ходовой к SPD
// на X (рейтинг Черты), а не на захардкоженный 0. effects.spdDamageReduce —
// ФЛАГ (как deflectorShield/autonomous), не готовое число: значение X у
// каждого шагохода своё, общий шаблон пака не может его нести.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { prepareVehicleDerived } from "../../module/rules/vehicle.mjs";

function multiLegged(rating) {
  return {
    type: "vehicleTrait",
    system: { rating, effects: { spdDamageReduce: true } }
  };
}

describe("prepareVehicleDerived — Многоногая (X) снижает урон Ходовой", () => {
  it("рейтинг 2 гасит 2 из 5 урона Ходовой: effSpd выше, чем без Черты", () => {
    const system = { chassis: { type: "walker", spd: 8, spdDamage: 5 } };
    prepareVehicleDerived([multiLegged(2)], system);
    // без Черты было бы max(0, 8-5)=3; с Чертой урон гасится до 3: max(0, 8-3)=5.
    expect(system.derived.effSpd).toBe(5);
    expect(system.derived.spdDamaged).toBe(true);
  });

  it("без Черты урон Ходовой бьёт по SPD как есть", () => {
    const system = { chassis: { type: "walker", spd: 8, spdDamage: 5 } };
    prepareVehicleDerived([], system);
    expect(system.derived.effSpd).toBe(3);
    expect(system.derived.spdDamaged).toBe(true);
  });

  it("рейтинг покрывает весь урон — Ходовая не считается повреждённой", () => {
    const system = { chassis: { type: "walker", spd: 8, spdDamage: 3 } };
    prepareVehicleDerived([multiLegged(9)], system);
    expect(system.derived.effSpd).toBe(8);
    expect(system.derived.spdDamaged).toBe(false);
  });
});
