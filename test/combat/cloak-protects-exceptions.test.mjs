// test/combat/cloak-protects-exceptions.test.mjs
//
// Cloak / Плащ (книга, «Броня»): «Плащ не защищает от атак с передней арки
// 90°, кроме как если персонаж: Лежит... или стоит в Защитной Стойке». До
// этой правки геометрия передней дуги (isFrontArcHit) считалась всегда,
// независимо от состояния защищающегося — Плащ терял защиту даже лёжа или в
// Защитной Стойке (wdbc-x1nz.4).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { cloakKeepsProtecting } from "../../module/combat/damage.mjs";

describe("Cloak/Плащ: исключения из потери защиты во фронтальной дуге", () => {
  it("обычный защитник — защиту теряет (решает геометрия снаружи)", () => {
    expect(cloakKeepsProtecting({ system: { conditions: {}, meleeStance: "standard" } })).toBe(false);
  });

  it("Лежит — защита сохраняется", () => {
    expect(cloakKeepsProtecting({ system: { conditions: { prone: true }, meleeStance: "standard" } })).toBe(true);
  });

  it("Защитная Стойка — защита сохраняется", () => {
    expect(cloakKeepsProtecting({ system: { conditions: {}, meleeStance: "defensive" } })).toBe(true);
  });

  it("нет актора — безопасный дефолт false (геометрия решает сама)", () => {
    expect(cloakKeepsProtecting(null)).toBe(false);
    expect(cloakKeepsProtecting(undefined)).toBe(false);
  });
});
